import React, { useEffect, useState } from 'react';
import { CreditRequest } from '../types';

interface DetailProps {
  requestId: string;
  onClose: () => void;
}

export default function ApplicationDetail({ requestId, onClose }: DetailProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/requests/${requestId}`)
      .then(res => res.json())
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(console.error);
  }, [requestId]);

  if (loading) return null;

  return (
    <>
      <div className="slide-over-overlay" onClick={onClose} />
      <div className="slide-over-panel">
        <div className="flex justify-between items-center mb-6">
          <h2>Detalle de Solicitud</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{padding: '0.25rem 0.5rem'}}>X</button>
        </div>

        <div className="mb-8">
          <h3>Información Base</h3>
          <p className="mt-4"><strong>ID:</strong> {data.id}</p>
          <p><strong>País:</strong> {data.country}</p>
          <p><strong>Monto Solicitado:</strong> ${Number(data.amount).toLocaleString()} {data.currency}</p>
        </div>

        <div className="mb-8">
          <h3>Criterio de Evaluación</h3>
          <div className="glass-panel" style={{ padding: '1rem', marginTop: '1rem' }}>
            <p className="text-sm">
              Esta solicitud fue evaluada asíncronamente por el Motor de Riesgos bajo las normativas del país ({data.country}).
            </p>
            {data.status === 'REJECTED' && (
               <p className="text-sm mt-4" style={{ color: 'var(--danger)' }}>
                 <strong>Motivo Rechazo:</strong> {data.bank_info?.reason || 'No se superaron las reglas de negocio.'}
               </p>
            )}
            {data.status === 'APPROVED' && (
               <p className="text-sm mt-4" style={{ color: 'var(--success)' }}>
                 <strong>Motivo Aprobación:</strong> {data.bank_info?.reason || 'Reglas de negocio cumplidas.'}
               </p>
            )}
          </div>
        </div>

        <div>
          <h3>Línea de Tiempo Operativa</h3>
          <div className="timeline mt-6">
            {data.timeline?.map((t: any) => (
              <div key={t.id} className="timeline-item">
                <p style={{ fontWeight: 600 }}>
                  {t.from_status ? `${t.from_status} → ` : 'Ingresado '}{t.to_status}
                </p>
                <p className="text-sm text-muted">{new Date(t.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
