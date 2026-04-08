// src/pages/Reportes.jsx 
import { useEffect, useState, useCallback, useRef } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { Card, Row, Col, Form, Button, Table, Badge, Spinner, Alert, Tabs, Tab } from "react-bootstrap";
import reportesService from "../services/reportesService";

const money = (v) => Number(v||0).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
const fmt   = (f) => f ? dayjs(f).format("DD/MM/YYYY") : "—";

// ── KPI ────────────────────────────────────────────────────────────────────────
function Kpi({ label, value, color="#1a3a5c" }) {
  return (
    <div className="p-3 rounded" style={{ background:"#f8faff", border:"1px solid #e8edf2" }}>
      <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".5px", color:"#6b7280", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
    </div>
  );
}

// ── Exportar Excel RF-14 ───────────────────────────────────────────────────────
function excelExport(filas, nombre, columnas) {
  const ws = XLSX.utils.json_to_sheet(filas.map(r => {
    const o = {}; columnas.forEach(([k,e]) => { o[e] = r[k] ?? ""; }); return o;
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, `${nombre}_${dayjs().format("YYYY-MM-DD")}.xlsx`);
}

// ── Exportar PDF RF-14 ─────────────────────────────────────────────────────────
function pdfExport(ref, titulo) {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${titulo}</title>
  <style>
    body{font-family:system-ui;font-size:12px;color:#1a1a2e;padding:24px}
    h2{margin:0 0 4px}
    .sub{color:#6b7280;font-size:11px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
    td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
    .kpi-row{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
    .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;min-width:150px}
    .kpi-l{font-size:10px;color:#6b7280;text-transform:uppercase}
    .kpi-v{font-size:18px;font-weight:700}
  </style></head><body>
  <h2>${titulo}</h2>
  <div class="sub">Generado el ${dayjs().format("DD/MM/YYYY HH:mm")}</div>
  ${ref.current?.innerHTML || ""}
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 500);
}

// ── Barra de filtros ───────────────────────────────────────────────────────────
function FiltroFechas({ desde, hasta, onDesde, onHasta, onAplicar, cargando, extras }) {
  return (
    <Card className="mb-3" style={{ border:"1px solid #e8edf2" }}>
      <Card.Body>
        <Row className="g-2 align-items-end">
          <Col xs={6} md={3}>
            <Form.Label className="mb-1" style={{ fontSize:12 }}>Desde</Form.Label>
            <Form.Control size="sm" type="date" value={desde} onChange={e=>onDesde(e.target.value)} />
          </Col>
          <Col xs={6} md={3}>
            <Form.Label className="mb-1" style={{ fontSize:12 }}>Hasta</Form.Label>
            <Form.Control size="sm" type="date" value={hasta} onChange={e=>onHasta(e.target.value)} />
          </Col>
          {extras}
          <Col xs={12} md="auto">
            <Button variant="primary" size="sm" onClick={onAplicar} disabled={cargando}>
              {cargando ? <Spinner animation="border" size="sm" /> : "Generar"}
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

// ── Botones exportar ──────────────────────────────────────────────────────────
function BotonesExport({ onPDF, onExcel, dis }) {
  return (
    <div className="d-flex gap-2 mb-2 justify-content-end">
      <Button variant="outline-danger"  size="sm" onClick={onPDF}   disabled={dis}>PDF</Button>
      <Button variant="outline-success" size="sm" onClick={onExcel} disabled={dis}>Excel</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Reportes() {
  const hoy    = dayjs().format("YYYY-MM-DD");
  const hace30 = dayjs().subtract(30,"day").format("YYYY-MM-DD");
  const [tab, setTab] = useState("resumen");

  // ── Meta RF-13 (fuentes y tipos de habitación) ────────────────────────────
  const [fuentes, setFuentes] = useState([]);
  const [tipos,   setTipos]   = useState([]);
  useEffect(() => {
    reportesService.meta()
      .then(r => { setFuentes(r.data.fuentes||[]); setTipos(r.data.tipos||[]); })
      .catch(() => {});
  }, []);

  const selFuente = (val, set) => (
    <Col xs={6} md={2}>
      <Form.Label className="mb-1" style={{ fontSize:12 }}>Fuente</Form.Label>
      <Form.Select size="sm" value={val} onChange={e=>set(e.target.value)}>
        <option value="">Todas</option>
        {fuentes.map(f=><option key={f} value={f}>{f}</option>)}
      </Form.Select>
    </Col>
  );
  const selTipo = (val, set) => (
    <Col xs={6} md={2}>
      <Form.Label className="mb-1" style={{ fontSize:12 }}>Tipo hab.</Form.Label>
      <Form.Select size="sm" value={val} onChange={e=>set(e.target.value)}>
        <option value="">Todos</option>
        {tipos.map(t=><option key={t} value={t}>{t}</option>)}
      </Form.Select>
    </Col>
  );

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  const [rDesde,setRDesde]=useState(hace30); const [rHasta,setRHasta]=useState(hoy);
  const [rFuente,setRFuente]=useState(""); const [rTipo,setRTipo]=useState("");
  const [resumen,setResumen]=useState(null); const [cargR,setCargR]=useState(false); const [errR,setErrR]=useState("");
  const refR = useRef(null);

  const cargarResumen = useCallback(async () => {
    setCargR(true); setErrR("");
    try {
      const {data} = await reportesService.resumen({desde:rDesde,hasta:rHasta,fuente:rFuente||undefined,tipo_habitacion:rTipo||undefined});
      setResumen(data);
    } catch(e) { setErrR(e?.response?.data?.message||"Error."); }
    finally { setCargR(false); }
  },[rDesde,rHasta,rFuente,rTipo]);

  useEffect(()=>{cargarResumen();},[]);// eslint-disable-line

  // ── OCUPACIÓN ─────────────────────────────────────────────────────────────
  const [oDesde,setODesde]=useState(hace30); const [oHasta,setOHasta]=useState(hoy); const [oTipo,setOTipo]=useState("");
  const [ocup,setOcup]=useState(null); const [cargO,setCargO]=useState(false); const [errO,setErrO]=useState("");
  const refO = useRef(null);

  const cargarOcup = useCallback(async () => {
    setCargO(true); setErrO("");
    try {
      const {data} = await reportesService.ocupacion({desde:oDesde,hasta:oHasta,tipo_habitacion:oTipo||undefined});
      setOcup(data);
    } catch(e) { setErrO(e?.response?.data?.message||"Error."); }
    finally { setCargO(false); }
  },[oDesde,oHasta,oTipo]);

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  const [iDesde,setIDesde]=useState(hace30); const [iHasta,setIHasta]=useState(hoy);
  const [iFuente,setIFuente]=useState(""); const [iAgrup,setIAgrup]=useState("dia");
  const [ingr,setIngr]=useState(null); const [cargI,setCargI]=useState(false); const [errI,setErrI]=useState("");
  const refI = useRef(null);

  const cargarIngr = useCallback(async () => {
    setCargI(true); setErrI("");
    try {
      const {data} = await reportesService.ingresos({desde:iDesde,hasta:iHasta,agrupar:iAgrup,fuente:iFuente||undefined});
      setIngr(data);
    } catch(e) { setErrI(e?.response?.data?.message||"Error."); }
    finally { setCargI(false); }
  },[iDesde,iHasta,iAgrup,iFuente]);

  // ── FRECUENTES ────────────────────────────────────────────────────────────
  const [frec,setFrec]=useState(null); const [cargF,setCargF]=useState(false); const [errF,setErrF]=useState("");
  const refF = useRef(null);

  const cargarFrec = useCallback(async () => {
    setCargF(true); setErrF("");
    try {
      const {data} = await reportesService.frecuentes({limite:25});
      setFrec(data);
    } catch(e) { setErrF(e?.response?.data?.message||"Error."); }
    finally { setCargF(false); }
  },[]);

  // ── POR HABITACIÓN ─────────────────────────────────────────────────────────
  const [hDesde,setHDesde]=useState(hace30); const [hHasta,setHHasta]=useState(hoy);
  const [habs,setHabs]=useState(null); const [cargH,setCargH]=useState(false); const [errH,setErrH]=useState("");
  const refH = useRef(null);

  const cargarHabs = useCallback(async () => {
    setCargH(true); setErrH("");
    try {
      const {data} = await reportesService.habitaciones({desde:hDesde,hasta:hHasta});
      setHabs(data);
    } catch(e) { setErrH(e?.response?.data?.message||"Error."); }
    finally { setCargH(false); }
  },[hDesde,hHasta]);

  const onTab = (k) => {
    setTab(k);
    if (k==="ocupacion"    && !ocup) cargarOcup();
    if (k==="ingresos"     && !ingr) cargarIngr();
    if (k==="frecuentes"   && !frec) cargarFrec();
    if (k==="habitaciones" && !habs) cargarHabs();
  };

  return (
    <div style={{ maxWidth:1200, margin:"0 auto" }}>
      <div className="mb-4">
        <h3 className="mb-0" style={{ fontWeight:700, color:"#1a1a2e" }}>Reportes</h3>
        <div className="text-muted" style={{ fontSize:13 }}>Estadísticas de ocupación, ingresos y huéspedes. Exporta en PDF o Excel.</div>
      </div>

      <Tabs activeKey={tab} onSelect={onTab} className="mb-3">

        {/* ── RESUMEN ─────────────────────────────────────────────────────── */}
        <Tab eventKey="resumen" title="Resumen general">
          <BotonesExport
            onPDF={() => pdfExport(refR,`Resumen ${rDesde} – ${rHasta}`)}
            onExcel={() => resumen && excelExport(
              [{total:resumen.reservas?.total,finalizadas:resumen.reservas?.finalizadas,canceladas:resumen.reservas?.canceladas,no_shows:resumen.reservas?.no_shows,ingresos:resumen.ingresos_periodo,estancia_prom:resumen.estancia_promedio}],
              "resumen",
              [["total","Reservas totales"],["finalizadas","Finalizadas"],["canceladas","Canceladas"],["no_shows","No-shows"],["ingresos","Ingresos COP"],["estancia_prom","Estancia prom (noches)"]]
            )}
            dis={cargR || !resumen}
          />
          <FiltroFechas desde={rDesde} hasta={rHasta} onDesde={setRDesde} onHasta={setRHasta} onAplicar={cargarResumen} cargando={cargR}
            extras={<>{selFuente(rFuente,setRFuente)}{selTipo(rTipo,setRTipo)}</>} />
          {errR && <Alert variant="warning">{errR}</Alert>}
          {cargR ? <div className="text-center py-4"><Spinner animation="border"/></div>
          : resumen ? (
            <div ref={refR}>
              <Row className="g-3 mb-4">
                <Col xs={6} md={3}><Kpi label="Reservas en el periodo" value={resumen.reservas?.total??0}        color="#1565c0"/></Col>
                <Col xs={6} md={3}><Kpi label="Ingresos del periodo"   value={money(resumen.ingresos_periodo)}   color="#15803d"/></Col>
                <Col xs={6} md={3}><Kpi label="Estancia promedio"       value={`${resumen.estancia_promedio} noches`} color="#6d28d9"/></Col>
                <Col xs={6} md={3}><Kpi label="No-shows"               value={resumen.reservas?.no_shows??0}    color="#b91c1c"/></Col>
              </Row>
              <Card style={{ border:"1px solid #e8edf2" }}>
                <Card.Body>
                  <div className="fw-semibold mb-3">Desglose de reservas</div>
                  <Row className="g-3">
                    <Col xs={6} md={3}><Kpi label="Finalizadas"         value={resumen.reservas?.finalizadas??0} color="#15803d"/></Col>
                    <Col xs={6} md={3}><Kpi label="Canceladas"          value={resumen.reservas?.canceladas??0}  color="#b45309"/></Col>
                    <Col xs={6} md={3}><Kpi label="No-shows"            value={resumen.reservas?.no_shows??0}   color="#b91c1c"/></Col>
                    <Col xs={6} md={3}><Kpi label="Habitaciones activas" value={resumen.total_habitaciones??0}  color="#1a3a5c"/></Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </Tab>

        {/* ── OCUPACIÓN ───────────────────────────────────────────────────── */}
        <Tab eventKey="ocupacion" title="Ocupación">
          <BotonesExport
            onPDF={() => pdfExport(refO,`Ocupación ${oDesde} – ${oHasta}`)}
            onExcel={() => ocup?.detalle && excelExport(ocup.detalle,"ocupacion",
              [["fecha","Fecha"],["habitaciones_ocupadas","Ocupadas"],["total_habitaciones","Total hab."],["porcentaje_ocupacion","% Ocupación"]])}
            dis={cargO || !ocup}
          />
          <FiltroFechas desde={oDesde} hasta={oHasta} onDesde={setODesde} onHasta={setOHasta} onAplicar={cargarOcup} cargando={cargO}
            extras={selTipo(oTipo,setOTipo)} />
          {errO && <Alert variant="warning">{errO}</Alert>}
          {cargO ? <div className="text-center py-4"><Spinner animation="border"/></div>
          : ocup ? (
            <div ref={refO}>
              <Row className="g-3 mb-3">
                <Col xs={6} md={4}><Kpi label="Ocupación promedio" value={`${ocup.promedio_ocupacion}%`} color="#1565c0"/></Col>
                <Col xs={6} md={4}><Kpi label="Ocupación máxima"   value={`${ocup.max_ocupacion}%`}     color="#15803d"/></Col>
                <Col xs={6} md={4}><Kpi label="Total habitaciones" value={ocup.total_habitaciones}       color="#1a3a5c"/></Col>
              </Row>
              <Card style={{ border:"1px solid #e8edf2" }}>
                <Card.Body>
                  <div className="fw-semibold mb-2">Detalle diario</div>
                  <div className="table-responsive" style={{ maxHeight:400, overflowY:"auto" }}>
                    <Table size="sm" className="align-middle mb-0">
                      <thead className="table-dark" style={{ position:"sticky", top:0 }}>
                        <tr><th>Fecha</th><th>Ocupadas</th><th>Total</th><th>%</th><th style={{ minWidth:160 }}>Barra</th></tr>
                      </thead>
                      <tbody>
                        {ocup.detalle.map(d => {
                          const pct = Number(d.porcentaje_ocupacion||0);
                          const col = pct>=80?"#16a34a":pct>=50?"#ca8a04":"#dc2626";
                          return (
                            <tr key={d.fecha}>
                              <td>{fmt(d.fecha)}</td>
                              <td className="fw-semibold">{d.habitaciones_ocupadas}</td>
                              <td>{d.total_habitaciones}</td>
                              <td style={{ color:col, fontWeight:600 }}>{pct}%</td>
                              <td><div style={{ background:"#e8edf2", borderRadius:4, height:12 }}>
                                <div style={{ width:`${pct}%`, height:"100%", background:col, borderRadius:4 }} />
                              </div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </Tab>

        {/* ── INGRESOS ────────────────────────────────────────────────────── */}
        <Tab eventKey="ingresos" title="Ingresos">
          <BotonesExport
            onPDF={() => pdfExport(refI,`Ingresos ${iDesde} – ${iHasta}`)}
            onExcel={() => ingr?.detalle && excelExport(ingr.detalle,"ingresos",
              [["periodo","Periodo"],["reservas","Reservas"],["ingresos","Ingresos COP"],["cargos","Cargos COP"]])}
            dis={cargI || !ingr}
          />
          <FiltroFechas desde={iDesde} hasta={iHasta} onDesde={setIDesde} onHasta={setIHasta} onAplicar={cargarIngr} cargando={cargI}
            extras={<>
              {selFuente(iFuente,setIFuente)}
              <Col xs={6} md={2}>
                <Form.Label className="mb-1" style={{ fontSize:12 }}>Agrupar por</Form.Label>
                <Form.Select size="sm" value={iAgrup} onChange={e=>setIAgrup(e.target.value)}>
                  <option value="dia">Día</option>
                  <option value="mes">Mes</option>
                </Form.Select>
              </Col>
            </>}
          />
          {errI && <Alert variant="warning">{errI}</Alert>}
          {cargI ? <div className="text-center py-4"><Spinner animation="border"/></div>
          : ingr ? (
            <div ref={refI}>
              <Row className="g-3 mb-3">
                <Col xs={6} md={4}><Kpi label="Total ingresos" value={money(ingr.total_ingresos)} color="#15803d"/></Col>
                <Col xs={6} md={4}><Kpi label="Total cargos"   value={money(ingr.total_cargos)}   color="#b45309"/></Col>
              </Row>
              <Card style={{ border:"1px solid #e8edf2" }}>
                <Card.Body>
                  <div className="fw-semibold mb-2">Detalle por {iAgrup==="mes"?"mes":"día"}</div>
                  <div className="table-responsive" style={{ maxHeight:400, overflowY:"auto" }}>
                    <Table size="sm" className="align-middle mb-0">
                      <thead className="table-dark" style={{ position:"sticky", top:0 }}>
                        <tr><th>Periodo</th><th>Reservas</th><th>Ingresos</th><th>Cargos</th></tr>
                      </thead>
                      <tbody>
                        {ingr.detalle.map(d => (
                          <tr key={d.periodo}>
                            <td className="fw-semibold">{d.periodo}</td>
                            <td>{d.reservas}</td>
                            <td className="text-success fw-semibold">{money(d.ingresos)}</td>
                            <td className="text-secondary">{money(d.cargos)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light fw-bold">
                        <tr><td colSpan={2}>Total</td>
                          <td className="text-success">{money(ingr.total_ingresos)}</td>
                          <td>{money(ingr.total_cargos)}</td>
                        </tr>
                      </tfoot>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </Tab>

        {/* ── HUÉSPEDES FRECUENTES ─────────────────────────────────────────── */}
        <Tab eventKey="frecuentes" title="Huéspedes frecuentes">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Button variant="outline-primary" size="sm" onClick={cargarFrec} disabled={cargF}>
              {cargF ? <Spinner animation="border" size="sm"/> : "Actualizar"}
            </Button>
            <BotonesExport
              onPDF={() => pdfExport(refF,"Huéspedes frecuentes")}
              onExcel={() => frec?.huespedes && excelExport(frec.huespedes,"huespedes_frecuentes",
                [["nombre_completo","Nombre"],["tipo_documento","Tipo doc"],["documento","Documento"],["nacionalidad","Nacionalidad"],["total_estadias","Estadías"],["primera_estadia","Primera visita"],["ultima_estadia","Última visita"],["total_pagado","Total pagado COP"]])}
              dis={cargF || !frec}
            />
          </div>
          {errF && <Alert variant="warning">{errF}</Alert>}
          {cargF ? <div className="text-center py-4"><Spinner animation="border"/></div>
          : frec ? (
            <div ref={refF}>
              <Card style={{ border:"1px solid #e8edf2" }}>
                <Card.Body>
                  <div className="fw-semibold mb-2">Top {frec.total} huéspedes por número de estadías</div>
                  <div className="table-responsive">
                    <Table size="sm" className="align-middle mb-0" hover>
                      <thead className="table-dark">
                        <tr><th>#</th><th>Huésped</th><th>Documento</th><th>Nacionalidad</th><th>Estadías</th><th>Primera visita</th><th>Última visita</th><th>Total pagado</th></tr>
                      </thead>
                      <tbody>
                        {frec.huespedes.map((h,i) => (
                          <tr key={h.id}>
                            <td className="text-muted">{i+1}</td>
                            <td>
                              <span className="fw-semibold">{h.nombre_completo}</span>
                              {h.email && <div className="text-muted" style={{ fontSize:11 }}>{h.email}</div>}
                            </td>
                            <td>{h.tipo_documento && h.documento ? `${h.tipo_documento} ${h.documento}` : "—"}</td>
                            <td>{h.nacionalidad||"—"}</td>
                            <td><Badge bg="primary" style={{ fontSize:13 }}>{h.total_estadias}</Badge></td>
                            <td>{fmt(h.primera_estadia)}</td>
                            <td>{fmt(h.ultima_estadia)}</td>
                            <td className="fw-semibold text-success">{money(h.total_pagado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </Tab>

        {/* ── POR HABITACIÓN ────────────────────────────────────────────── */}
        <Tab eventKey="habitaciones" title="Por habitación">
          <FiltroFechas desde={hDesde} hasta={hHasta} onDesde={setHDesde} onHasta={setHHasta}
            onAplicar={cargarHabs} cargando={cargH} />
          {errH && <Alert variant="warning">{errH}</Alert>}
          {cargH ? <div className="text-center py-4"><Spinner animation="border"/></div>
          : habs ? (
            <div ref={refH}>
              <div className="d-flex justify-content-end mb-2 gap-2">
                <BotonesExport
                  onPDF={() => pdfExport(refH,"Estadísticas por habitación")}
                  onExcel={() => excelExport(habs.habitaciones,"habitaciones",
                    [["numero","Habitación"],["tipo","Tipo"],["total_reservas","Reservas"],
                     ["noches_ocupadas","Noches ocup."],["ocupacion_pct","Ocup. %"],["ingresos_generados","Ingresos COP"]])}
                  dis={cargH || !habs}
                />
              </div>
              <Card style={{ border:"1px solid #e8edf2" }}>
                <Card.Body>
                  <div className="table-responsive">
                    <Table size="sm" className="align-middle mb-0" hover>
                      <thead className="table-dark">
                        <tr>
                          <th>Habitación</th><th>Tipo</th><th>Reservas</th>
                          <th>Noches ocupadas</th><th>% Ocupación</th><th>Ingresos generados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {habs.habitaciones.map(h => (
                          <tr key={h.id}>
                            <td className="fw-semibold">Hab. {h.numero}</td>
                            <td>{h.tipo}</td>
                            <td className="text-center">{h.total_reservas}</td>
                            <td className="text-center">{h.noches_ocupadas}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="progress flex-grow-1" style={{ height:8 }}>
                                  <div className="progress-bar bg-primary" style={{ width:`${h.ocupacion_pct}%` }}/>
                                </div>
                                <span style={{ fontSize:12, minWidth:34 }}>{h.ocupacion_pct}%</span>
                              </div>
                            </td>
                            <td className="fw-semibold text-success">{money(h.ingresos_generados)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </Tab>

      </Tabs>
    </div>
  );
}