const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Factura', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fechaEmision: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    total: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 }
  }, { tableName: 'facturas', timestamps: true });
