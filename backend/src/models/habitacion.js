const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Habitacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numero: { type: DataTypes.STRING, allowNull: false },
    tipo: { type: DataTypes.STRING },
    estado: { type: DataTypes.ENUM('disponible','ocupada','mantenimiento'), defaultValue: 'disponible' },
    capacidad: { type: DataTypes.INTEGER, defaultValue: 1 }
  }, { tableName: 'habitaciones', timestamps: true });
