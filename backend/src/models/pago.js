const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Pago', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fechaPago: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    valorPagado: { type: DataTypes.DECIMAL(10,2), allowNull: false },
    metodoPago: { type: DataTypes.STRING }
  }, { tableName: 'pagos', timestamps: true });
