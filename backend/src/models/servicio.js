const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Servicio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    costo: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
    descripcion: { type: DataTypes.TEXT }
  }, { tableName: 'servicios', timestamps: true });
