import BaseService from '../BaseService'
import User from 'App/Models/Users/User'
import Drive from '@ioc:Adonis/Core/Drive'
import Redis from '@ioc:Adonis/Addons/Redis'
import Logger from '@ioc:Adonis/Core/Logger'
import UserService from '../Users/UserService'
import Database from '@ioc:Adonis/Lucid/Database'
import Estate from 'App/Models/RealEstates/Estate'
import RealEstate from 'App/Models/RealEstates/RealEstate'
import RealEstateValidator from 'App/Validators/RealEstates/RealEstateValidator'
import RealEstateApiValidator from 'App/Validators/Api/RealEstates/RealEstateValidator'
import RealEstateRecommendedValidator from 'App/Validators/Api/RealEstates/RealEstateRecommendedValidator'
import { DateTime } from 'luxon'
import { REAL_ESTATE_PATH } from 'Config/drive'
import { ModelPaginatorContract } from '@ioc:Adonis/Lucid/Orm'
import { ResponseCodes, ResponseMessages } from 'Contracts/response'
import { removeFirstWord, removeLastLetter } from '../../../helpers'
import { Error, PaginateConfig, ServiceConfig } from 'Contracts/services'

type Columns = typeof RealEstate['columns'][number]
type ValidatorPayload = RealEstateValidator['schema']['props']
type GetMethodConfig = ServiceConfig<RealEstate> & {
  isForApi?: boolean,
}

export default class RealEstateService extends BaseService {
  public static async paginate(config: PaginateConfig<Columns, RealEstate>, columns: Columns[] = []): Promise<ModelPaginatorContract<RealEstate>> {
    let query = RealEstate.query().select(columns)
    if (config.relations) {
      for (const item of config.relations) {
        query = query.preload(item)
      }
    }

    return await query.get(config)
  }

  public static async get(uuid: RealEstate['uuid'], config: GetMethodConfig = {}): Promise<RealEstate> {
    let item: RealEstate | null

    try {
      item = await RealEstate.findBy('uuid', uuid, { client: config.trx })
    } catch (err: any) {
      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }

    if (!item)
      throw { code: ResponseCodes.CLIENT_ERROR, message: ResponseMessages.REAL_ESTATE_NOT_FOUND } as Error

    try {
      if (config.relations) {
        for (let relationItem of config.relations) {
          await item.load(relationItem)
        }
      }

      return item
    } catch (err: any) {
      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async create(payload: ValidatorPayload, { trx }: ServiceConfig<RealEstate> = {}): Promise<RealEstate> {
    let item: RealEstate
    let image: string | undefined
    let imageBasePath: string

    if (!trx)
      trx = await Database.transaction()

    try {
      item = await RealEstate.create({ ...payload, image }, { client: trx })

      imageBasePath = `${REAL_ESTATE_PATH}/${item.uuid}`
    } catch (err: any) {
      await trx.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }

    try {
      if (payload.image) {
        await payload.image.moveToDisk(imageBasePath)
        image = `${imageBasePath}/${payload.image.fileName}`
      }

      if (payload.images) {
        for (const imageItem of payload.images) {
          if (imageItem) {
            await imageItem.moveToDisk(`${imageBasePath}/images`)
            await item.related('images').create({ image: `${imageBasePath}/images/${imageItem.fileName}` })
          }
        }
      }
    } catch (err: any) {
      await trx.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.SERVER_ERROR, message: ResponseMessages.ERROR } as Error
    }

    await trx.commit()
    return item
  }

  public static async update(uuid: RealEstate['uuid'], payload: ValidatorPayload, { trx }: ServiceConfig<RealEstate> = {}): Promise<RealEstate> {
    let item: RealEstate
    let image: string | undefined
    let imageBasePath: string

    if (!trx)
      trx = await Database.transaction()

    try {
      item = await this.get(uuid, { trx })

      imageBasePath = `${REAL_ESTATE_PATH}/${item.uuid}`
    } catch (err: Error | any) {
      await trx.rollback()

      throw err
    }

    try {
      if (payload.image) {
        if (item.image)
          await Drive.delete(item.image)

        await payload.image.moveToDisk(imageBasePath)
        image = `${imageBasePath}/${payload.image.fileName}`
      }

      if (payload.images) {
        for (const value of item.images) {
          await Drive.delete(value.image)
          await value.delete()
        }

        for (const imageItem of payload.images) {
          if (imageItem) {
            await imageItem.moveToDisk(`${imageBasePath}/images`)
            await item.related('images').create({ image: `${imageBasePath}/images/${imageItem.fileName}` })
          }
        }
      }
    } catch (err: any) {
      await trx.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.SERVER_ERROR, message: ResponseMessages.ERROR } as Error
    }

    try {
      await trx.commit()

      return await item.merge({ ...payload, image }).save()
    } catch (err: any) {
      await trx.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async delete(uuid: RealEstate['uuid'], { trx }: ServiceConfig<RealEstate> = {}): Promise<void> {
    let item: RealEstate

    if (!trx)
      trx = await Database.transaction()

    try {
      item = await this.get(uuid, { trx })
    } catch (err: Error | any) {
      await trx.rollback()

      throw err
    }

    try {
      await item.delete()
    } catch (err: any) {
      await trx.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }

    try {
      if (item.image)
        await Drive.delete(item.image)

      if (item.images) {
        for (const imageItem of item.images) {
          await Drive.delete(imageItem.image)
          await imageItem.delete()
        }
      }

      await trx.commit()
    } catch (err: any) {
      await trx.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.SERVER_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async block(uuid: RealEstate['uuid'], { trx }: ServiceConfig<RealEstate> = {}): Promise<RealEstate> {
    try {
      return (await this.get(uuid, { trx })).merge({ isBanned: true }).save()
    } catch (err: Error | any) {
      throw err
    }
  }

  public static async unblock(uuid: RealEstate['uuid'], { trx }: ServiceConfig<RealEstate> = {}): Promise<RealEstate> {
    try {
      return (await this.get(uuid, { trx })).merge({ isBanned: false }).save()
    } catch (err: Error | any) {
      throw err
    }
  }

  public static async search(payload: RealEstateApiValidator['schema']['props']): Promise<RealEstate[]> {
    if (!payload.limit)
      payload.limit = 15

    try {
      let query = RealEstate.query().preload('images')

      for (const key in payload) {
        if (payload[key]) {
          switch (key) {
            // Skip this api's keys
            case 'page':
            case 'limit':
            case 'orderBy':
              break
            // Skip this api's keys

            case 'districts':
              for (const item of payload[key]!) {
                query = query.orWhere('address', 'like', `%${item}%`)
              }
              break

            case 'addressOrResidentalComplex':
              query = query
                .where('residentalComplex', 'like', `%${payload[key]}%`)
                .orWhere('address', 'like', `%${payload[key]}%`)
              break

            case 'ceilingHeight':
            case 'yearOfConstruction': // @ts-ignore
              query = query.where(key, '>=', payload[key]!)
              break

            case 'WCTypes':
            case 'roomTypes':
            case 'repairTypes':
            case 'rentalTypes':
            case 'layoutTypes':
            case 'balconyTypes':
            case 'elevatorTypes':
            case 'houseBuildingTypes':
              for (let item of payload[key]!) {
                query = query.orWhere(removeLastLetter(key), item!)
              }
              break

            case 'startPrice':
            case 'startFloor':
            case 'startMaxFloor':
            case 'startTotalArea':
            case 'startLivingArea':
            case 'startKitchenArea':
              query = query.where(removeFirstWord(key, 'start'), '>=', payload[key]!)
              break

            case 'endPrice':
            case 'endFloor':
            case 'endMaxFloor':
            case 'endTotalArea':
            case 'endLivingArea':
            case 'endKitchenArea':
              query = query.where(removeFirstWord(key, 'end'), '<=', payload[key]!)
              break

            default:
              query = query.where(key, payload[key])
              break
          }
        }
      }

      return await query.get({ page: payload.page, limit: payload.limit, orderBy: payload.orderBy })
    } catch (err: any) {
      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async popular(limit?: number): Promise<ModelPaginatorContract<RealEstate>> {
    const popularConfig: PaginateConfig<Columns, RealEstate> = {
      limit,
      page: 1,
      orderByColumn: 'viewsCount',
      orderBy: 'desc',
    }

    try {
      return await this.paginate(popularConfig)
    } catch (err: Error | any) {
      throw err
    }
  }

  public static async recommended(payload: RealEstateRecommendedValidator['schema']['props']): Promise<RealEstate[]> {
    let user: User
    const recommended: RealEstate[] = []

    try {
      user = await UserService.getById(payload.userId, { relations: ['realEstatesWishList'] })
    } catch (err: Error | any) {
      throw err
    }

    try {
      if (user.realEstatesWishList.length) {
        for (let i = 0; i < payload.limit; i++) {
          const random: number = Math.floor(Math.random() * user.realEstatesWishList.length)
          const estateId: Estate['id'] = user.realEstatesWishList[random - 1].estateId

          const realEstateItem: RealEstate = await RealEstate.query().where('estateId', estateId).random()
          recommended.push(realEstateItem)
        }
      } else {
        const popular = await this.popular(payload.limit)

        for (const item of popular) {
          const realEstateItem: RealEstate = await RealEstate.query().where('estateId', item.estateId).random()
          recommended.push(realEstateItem)
        }
      }

      return recommended
    } catch (err: any) {
      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async incrementTodayViewsCount(item: RealEstate): Promise<number> {
    const DAY_IN_SECONDS: number = 86400
    const CURRENT_TIME: number = DateTime.now().second
    const EXPIRATION: number = DAY_IN_SECONDS - CURRENT_TIME

    try {
      let currentViewsCount: number = Number(await Redis.get(item.uuid))
      const incrementedViewsCount: number = ++currentViewsCount

      await Redis.set(item.uuid, incrementedViewsCount, 'EX', EXPIRATION)

      return incrementedViewsCount
    } catch (err: any) {
      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }
}
