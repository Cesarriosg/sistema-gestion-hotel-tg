const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Auditoria', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    accion: { type: DataTypes.STRING },
    descripcion: { type: DataTypes.TEXT },
    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, { tableName: 'auditorias', timestamps: false });
