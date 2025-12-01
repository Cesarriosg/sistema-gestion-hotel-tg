const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Usuario', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    rol: { type: DataTypes.ENUM('admin','recepcionista'), allowNull: false, defaultValue: 'recepcionista' },
    estado: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'usuarios', timestamps: true });
