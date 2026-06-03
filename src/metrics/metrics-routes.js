import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = express.Router();

router.get('/api/metrics', requireAuth, requirePermission('metrics:read'), (req, res) => {
  try {
    // 1. Contador de tickets por estado
    const totalOpen = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'abierto'").get().count;
    const totalInProgress = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'en_progreso'").get().count;
    
    // Tickets resueltos hoy
    const totalResolvedToday = db.prepare(`
      SELECT COUNT(*) as count 
      FROM tickets 
      WHERE status = 'resuelto' 
      AND date(resolved_at) = date('now', 'localtime')
    `).get().count;

    // Tickets creados esta semana
    const totalThisWeek = db.prepare(`
      SELECT COUNT(*) as count 
      FROM tickets 
      WHERE date(created_at) >= date('now', '-7 days', 'localtime')
    `).get().count;

    // 2. Desglose de tickets por área
    const byArea = db.prepare(`
      SELECT area, COUNT(*) as count 
      FROM tickets 
      GROUP BY area 
      ORDER BY count DESC
    `).all();

    // 3. Desglose de tickets por prioridad
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM tickets 
      GROUP BY priority
    `).all();

    // 4. Desglose de tickets por estado
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tickets 
      GROUP BY status
    `).all();

    // 5. Tasa de autoservicio (chatbot / FAQ exitoso)
    const faqHits = db.prepare("SELECT COUNT(*) as count FROM faq_hits").get().count;
    const faqResolved = db.prepare("SELECT COUNT(*) as count FROM faq_hits WHERE resolved = 1").get().count;
    
    const autoserviceRate = faqHits > 0 ? Math.round((faqResolved / faqHits) * 100) : 0;

    // 6. Tiempo promedio de resolución en horas
    // Nota: strftime('%s') calcula la diferencia en segundos en SQLite
    const avgResolutionRow = db.prepare(`
      SELECT AVG((strftime('%s', resolved_at) - strftime('%s', created_at)) / 3600.0) as avg_hours 
      FROM tickets 
      WHERE status = 'resuelto' AND resolved_at IS NOT NULL
    `).get();
    
    const avgResolutionHours = avgResolutionRow?.avg_hours ? parseFloat(avgResolutionRow.avg_hours.toFixed(1)) : 0;

    // 7. Últimos 10 tickets recibidos con el nombre del agente asignado
    const recentTickets = db.prepare(`
      SELECT t.*, a.name as agent_name 
      FROM tickets t 
      LEFT JOIN agents a ON t.assigned_to = a.id 
      ORDER BY t.created_at DESC 
      LIMIT 10
    `).all();

    // Formatear áreas en la respuesta de tickets recientes
    const AREA_LABELS = {
      'cartera': 'Cartera',
      'compra': 'Compra',
      'gestion_humana': 'Gestión Humana',
      'pqrs': 'PQRS',
      'contabilidad': 'Contabilidad',
      'farmacia': 'Farmacia',
      'cuentas_medicas': 'Cuentas Médicas',
      'general': 'General / IT'
    };

    const formattedRecentTickets = recentTickets.map(ticket => ({
      ...ticket,
      area_label: AREA_LABELS[ticket.area] || ticket.area
    }));

    res.json({
      summary: {
        open_tickets: totalOpen,
        in_progress_tickets: totalInProgress,
        resolved_today: totalResolvedToday,
        created_this_week: totalThisWeek,
        autoservice_rate: autoserviceRate,
        faq_total: faqHits,
        faq_resolved: faqResolved,
        avg_resolution_hours: avgResolutionHours
      },
      by_area: byArea.map(item => ({
        area: item.area,
        area_label: AREA_LABELS[item.area] || item.area,
        count: item.count
      })),
      by_priority: byPriority,
      by_status: byStatus,
      recent_tickets: formattedRecentTickets
    });

  } catch (error) {
    console.error('Error en GET /api/metrics:', error);
    res.status(500).json({ error: 'Error interno al procesar estadísticas.' });
  }
});

/* ─ GET /api/metrics/trend — Tendencia de los últimos 7 días + SLA ─ */
router.get('/api/metrics/trend', requireAuth, requirePermission('metrics:read'), (req, res) => {
  try {
    // 1. Tickets creados por día (últimos 7 días)
    const trendRows = db.prepare(`
      SELECT date(created_at, 'localtime') as day, COUNT(*) as count
      FROM tickets
      WHERE created_at >= datetime('now', '-6 days', 'localtime')
      GROUP BY day ORDER BY day ASC
    `).all();

    const trend = [];
    const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayIso   = d.toISOString().slice(0, 10);
      const dayLabel = `${DAYS_ES[d.getDay()]} ${d.getDate()}`;
      const found    = trendRows.find(r => r.day === dayIso);
      trend.push({ day: dayLabel, count: found ? found.count : 0 });
    }

    // 2. SLA: calcular sobre tickets abiertos
    const SLA_HOURS = { critica: 2, alta: 8, media: 48, baja: 168 };
    const openTickets = db.prepare(
      `SELECT priority, created_at FROM tickets WHERE status IN ('abierto','en_progreso','en_espera')`
    ).all();

    const now = Date.now();
    let sla_breached = 0, sla_warning = 0;
    for (const t of openTickets) {
      const h        = SLA_HOURS[t.priority] || 48;
      const deadline = new Date(t.created_at).getTime() + h * 3_600_000;
      const remaining = deadline - now;
      if (remaining < 0) sla_breached++;
      else if (remaining < h * 3_600_000 * 0.25) sla_warning++;
    }

    res.json({ trend, sla: { breached: sla_breached, warning: sla_warning, open: openTickets.length } });
  } catch (err) {
    console.error('Error en GET /api/metrics/trend:', err);
    res.status(500).json({ error: 'Error al obtener tendencia.' });
  }
});

export default router;
