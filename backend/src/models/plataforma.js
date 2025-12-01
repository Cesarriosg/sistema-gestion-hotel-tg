const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define('Plataforma', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING },
    url: { type: DataTypes.STRING },
    apiKey: { type: DataTypes.STRING },
    sincronizacionAutomatica: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'plataformas', timestamps: true });
