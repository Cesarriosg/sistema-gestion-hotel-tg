const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Reserva', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fechaInicio: { type: DataTypes.DATEONLY, allowNull: false },
    fechaFin: { type: DataTypes.DATEONLY, allowNull: false },
    estado: { type: DataTypes.ENUM('pendiente','confirmada','cancelada','no-show'), defaultValue: 'pendiente' },
    notas: { type: DataTypes.TEXT }
  }, { tableName: 'reservas', timestamps: true });
