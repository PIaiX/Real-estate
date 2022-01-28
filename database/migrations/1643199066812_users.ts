import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Users extends BaseSchema {
  protected tableName = 'users'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('firstName').notNullable()
      table.string('lastName').notNullable()
      table.integer('sex').unsigned().nullable().comment('Пол, 0 - мужчина, 1 - женщина')
      table.date('birthday').nullable()
      table.string('phone').unique().nullable()
      table.string('email').unique().notNullable()
      table.string('avatar').nullable()
      table
        .decimal('rating', 2, 1)
        .defaultTo(0)
        .notNullable()
        .comment('От 0 до 5, с шагом 0.5')
      table.string('password').notNullable()
      table.boolean('isSubscribed').defaultTo(1).notNullable().comment('Подписан ли на уведомления. 0 - нет, 1 - да')
      table.boolean('isBanned').defaultTo(0).notNullable().comment('0 - нет, 1 - да')
      table.boolean('isActivated').defaultTo(0).notNullable().comment('Активация по почте. 0 - аккаунт не активен, 1 - активен')

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('createdAt', { useTz: true })
      table.timestamp('updatedAt', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
