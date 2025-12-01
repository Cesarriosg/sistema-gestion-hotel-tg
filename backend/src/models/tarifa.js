const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Tarifa', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipoHabitacion: { type: DataTypes.STRING },
    precio: { type: DataTypes.DECIMAL(10,2) },
    fechaInicio: { type: DataTypes.DATEONLY },
    fechaFin: { type: DataTypes.DATEONLY },
    temporada: { type: DataTypes.STRING }
  }, { tableName: 'tarifas', timestamps: true });
