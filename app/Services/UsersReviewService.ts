import Logger from '@ioc:Adonis/Core/Logger'
import UsersReview from 'App/Models/UsersReview'
import UsersReviewValidator from 'App/Validators/UsersReviewValidator'
import { Error, GetAllConfig, GetConfig } from 'Contracts/services'
import { ResponseCodes, ResponseMessages } from 'Contracts/response'

type UsersReviewPayload = UsersReviewValidator['schema']['props']

export default class UsersReviewService {
  public static async paginate(config: GetAllConfig<typeof UsersReview['columns'][number], UsersReview>): Promise<UsersReview[]> {
    if (!config.columns)
      config.columns = ['id', 'rating', 'fromId', 'toId', 'createdAt']

    let query = UsersReview.query()
    if (config.relations) {
      for (let item of config.relations) {
        query = query.preload(item)
      }
    }

    return await query.select(config.columns).get(config)
  }

  public static async get(config: GetConfig<UsersReview>): Promise<UsersReview> {
    let item: UsersReview | null

    try {
      item = await UsersReview.findBy(config.column, config.val, { client: config.trx })
    } catch (err: any) {
      await config.trx?.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }

    if (!item) {
      await config.trx?.rollback()

      throw { code: ResponseCodes.CLIENT_ERROR, message: ResponseMessages.USERS_REVIEW_NOT_FOUND } as Error
    }

    try {
      if (config.relations) {
        for (let relationItem of config.relations) {
          await item.load(relationItem)
        }
      }

      await config.trx?.commit()
      return item
    } catch (err: any) {
      await config.trx?.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async update(config: GetConfig<UsersReview>, payload: UsersReviewPayload): Promise<UsersReview> {
    let item: UsersReview

    try {
      item = await this.get(config)
    } catch (err: Error | any) {
      throw err
    }

    try {
      await item.merge(payload).save()

      await config.trx?.commit()
      return item
    } catch (err: any) {
      await config.trx?.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }

  public static async delete(config: GetConfig<UsersReview>): Promise<void> {
    let item: UsersReview

    try {
      item = await this.get(config)
    } catch (err: Error | any) {
      throw err
    }

    try {
      await item.delete()

      await config.trx?.commit()
    } catch (err: any) {
      await config.trx?.rollback()

      Logger.error(err)
      throw { code: ResponseCodes.DATABASE_ERROR, message: ResponseMessages.ERROR } as Error
    }
  }
}
