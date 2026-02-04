// src/controllers/channex.controller.js
import axios from "axios";
import { otaCrearOActualizarReservaSandbox } from "./otas.controller.js";

export const channexWebhook = async (req, res) => {
  try {
    // 1️⃣ Channex SIEMPRE espera 200 OK
    res.status(200).json({ ok: true });

    const { booking_revision_id } = req.body;

    if (!booking_revision_id) return;

    // 2️⃣ Pedimos la reserva completa a Channex
    const booking = await axios.get(
      `https://staging.channex.io/api/v1/booking_revisions/${booking_revision_id}`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.CHANNEX_API_KEY}`
        }
      }
    );

    const data = booking.data.data;

    // 3️⃣ Normalizamos a tu formato interno
    await otaCrearOActualizarReservaSandbox(
      {
        body: {
          ota_canal: "channex",
          ota_reserva_id: data.id,
          habitacion_numero: data.rooms[0].room_type_code,
          fecha_inicio: data.arrival_date,
          fecha_fin: data.departure_date,
          titular: {
            nombre: data.guest_name,
            email: data.guest_email,
            telefono: data.guest_phone
          },
          payload: data
        }
      },
      { status: () => ({ json: () => {} }) }
    );

  } catch (error) {
    console.error("Webhook Channex error:", error.message);
  }
};
