const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database').development;

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: false
});

// cargar modelos
const Usuario = require('./usuario')(sequelize);
const Huesped = require('./huesped')(sequelize);
const Habitacion = require('./habitacion')(sequelize);
const Reserva = require('./reserva')(sequelize);
const Factura = require('./factura')(sequelize);
const Pago = require('./pago')(sequelize);
const Servicio = require('./servicio')(sequelize);
const Tarifa = require('./tarifa')(sequelize);
const Plataforma = require('./plataforma')(sequelize);
const Auditoria = require('./auditoria')(sequelize);

// relaciones (ejemplos básicos)
Usuario.hasMany(Reserva, { foreignKey: 'usuarioId' });
Reserva.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Huesped.hasMany(Reserva, { foreignKey: 'huespedId' });
Reserva.belongsTo(Huesped, { foreignKey: 'huespedId' });

Habitacion.hasMany(Reserva, { foreignKey: 'habitacionId' });
Reserva.belongsTo(Habitacion, { foreignKey: 'habitacionId' });

Reserva.hasOne(Factura, { foreignKey: 'reservaId' });
Factura.belongsTo(Reserva, { foreignKey: 'reservaId' });

Factura.hasMany(Pago, { foreignKey: 'facturaId' });
Pago.belongsTo(Factura, { foreignKey: 'facturaId' });

module.exports = {
  sequelize,
  Sequelize,
  Usuario,
  Huesped,
  Habitacion,
  Reserva,
  Factura,
  Pago,
  Servicio,
  Tarifa,
  Plataforma,
  Auditoria
};
