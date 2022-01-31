import User from 'App/Models/User'
import BaseService from './BaseService'
import UserService from './UserService'
import Hash from '@ioc:Adonis/Core/Hash'
import LoginValidator from 'App/Validators/LoginValidator'
import { Roles } from 'Contracts/enums'

export default class AuthService extends BaseService {
  public static async login({ email, password }: LoginValidator['schema']['props']): Promise<User> {
    try {
      let candidate: User = (await User.findBy('email', email))!

      if (await Hash.verify(candidate.password, password))
        return candidate
      else
        throw new Error('User is not registered!')
    } catch (err: Error | any) {
      throw new Error(err)
    }
  }

  public static async checkAdmin(id: User['id']): Promise<void> {
    let accessRoles: Roles[] = [Roles.ADMIN, Roles.MANAGER]

    try {
      let currentUser: User = await UserService.get(id)
      await currentUser.load('role')

      if (!accessRoles.includes(currentUser.role.name as Roles))
        throw new Error('Вы не являетесь администратором!')
    } catch (err: Error | any) {
      throw new Error(err)
    }
  }
}
