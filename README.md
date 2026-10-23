# Sistema de Gestión Hotelera

Sistema web para la gestión integral de pequeños y medianos establecimientos hoteleros, desarrollado como proyecto de trabajo de grado para optimizar los procesos administrativos y operativos de los hoteles.

##  Descripción del proyecto

El **Sistema de Gestión Hotelera (SGH)** es una aplicación web diseñada para facilitar la administración de las operaciones internas de los establecimientos hoteleros, centralizando la información y mejorando el control de los procesos de recepción, reservas, huéspedes y habitaciones.

El proyecto surge como respuesta a las dificultades que enfrentan algunos hoteles al gestionar sus operaciones mediante procesos manuales o herramientas poco integradas, lo que puede ocasionar errores en las reservas, inconsistencias en la información y dificultades en el seguimiento de las actividades operativas.

La solución busca mejorar la eficiencia administrativa, facilitar el acceso a la información y contribuir a la calidad del servicio ofrecido a los huéspedes.

##  Objetivo general

Desarrollar un sistema web para la gestión integral de pequeños y medianos establecimientos hoteleros, que permita optimizar los procesos administrativos y operativos mediante la centralización de la información y la automatización de tareas.

##  Funcionalidades principales

- **Gestión de usuarios:** administración del acceso al sistema según los roles y permisos establecidos.
- **Gestión de huéspedes:** registro y consulta de la información de los huéspedes.
- **Gestión de reservas:** administración y seguimiento de las reservas hoteleras.
- **Control de habitaciones:** consulta y actualización de los estados de las habitaciones.
- **Gestión de pagos y facturación:** apoyo al control de pagos y procesos de facturación contemplados en el sistema.
- **Reportes:** consulta de información relevante para apoyar la toma de decisiones administrativas.
- **Integración con plataformas externas:** diseño de integración con canales de distribución hotelera mediante Channex y recepción de notificaciones de reservas a través de webhooks.
- **Actualización de información:** estructura preparada para facilitar la comunicación entre los componentes de la aplicación.

## Tecnologías utilizadas

### Frontend

- React.js
- JavaScript
- HTML5
- CSS3
- Bootstrap 5
- Axios / Fetch API

### Backend

- Node.js
- Express.js
- API REST
- JSON Web Tokens (JWT)
- bcryptjs
- Socket.IO

### Base de datos

- PostgreSQL
- node-postgres (`pg`)

### Herramientas de desarrollo

- Git
- GitHub
- Visual Studio Code
- Trello

## Arquitectura del sistema

El sistema utiliza una arquitectura cliente-servidor compuesta por los siguientes elementos:

1. **Frontend:** interfaz web desarrollada con React.js para la interacción de los usuarios con el sistema.
2. **Backend:** servidor desarrollado con Node.js y Express.js, encargado de gestionar las solicitudes, aplicar las reglas de negocio y controlar el acceso a los recursos.
3. **Base de datos:** PostgreSQL para el almacenamiento y la consulta de la información.
4. **Autenticación y autorización:** mecanismos de autenticación mediante JWT y contraseñas protegidas mediante hash.
5. **Comunicación en tiempo real:** Socket.IO para las funcionalidades que requieren actualización de información en tiempo real.
6. **Integración externa:** componente de integración con Channex para el procesamiento de notificaciones de reservas, según la configuración implementada.

##  Roles de usuario

El sistema contempla dos roles principales:

- **Administrador:** acceso a las funcionalidades administrativas autorizadas del sistema.
- **Recepcionista:** acceso a las funcionalidades operativas relacionadas con la recepción y la gestión hotelera, según sus permisos.


##  Metodología de desarrollo

El desarrollo del proyecto se apoya en un enfoque ágil, utilizando **Kanban** para organizar, visualizar y realizar seguimiento a las tareas mediante un tablero de trabajo.

Esta metodología permite gestionar las actividades de desarrollo, identificar avances y organizar las tareas pendientes durante la construcción del sistema.

## Contexto académico

Proyecto desarrollado como trabajo de grado para optar al título de **Ingeniero de Sistemas**.

**Autor:** César Antonio Ríos González

**Institución:** Universidad del Valle

**Área:** Desarrollo de software e ingeniería de sistemas.

## Mejoras futuras

Entre las posibles líneas de evolución del proyecto se encuentran:

- Ampliación de las integraciones con plataformas de distribución hotelera.
- Fortalecimiento de los reportes e indicadores administrativos.
- Optimización de los procesos de mantenimiento y seguimiento de habitaciones.
- Ampliación de las pruebas de seguridad, rendimiento y usabilidad.
- Incorporación de nuevas funcionalidades de acuerdo con las necesidades de los establecimientos hoteleros.

**Sistema de Gestión Hotelera — Proyecto de trabajo de grado.**
