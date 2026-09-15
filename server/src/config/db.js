import { Sequelize } from 'sequelize'; import config from './database.cjs';
export const sequelize=new Sequelize(config[process.env.NODE_ENV||'development']);
