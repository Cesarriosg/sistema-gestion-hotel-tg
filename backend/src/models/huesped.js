const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Huesped', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    tipoDocumento: { type: DataTypes.STRING },
    numeroDocumento: { type: DataTypes.STRING },
    telefono: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    direccion: { type: DataTypes.STRING }
  }, { tableName: 'huespedes', timestamps: true });
