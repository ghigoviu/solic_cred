import React, { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CreditRequest, StatusEvent } from '../types';
import ApplicationForm from '../components/ApplicationForm';
import ApplicationDetail from '../components/ApplicationDetail';

interface ToastMsg {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'evaluating';
}

export default function Dashboard() {
  const [country, setCountry] = useState('MX');
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flashingRows, setFlashingRows] = useState<Set<string>>(new Set());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((msg: string, type: ToastMsg['type']) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    // 1. Fetch initial data
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/requests?country=${country}`);
        const data = await res.json();
        setRequests(data);
      } catch (e) {
        console.error("Failed to fetch", e);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();

    // 2. Setup WebSocket
    const socket: Socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    
    socket.on('connect', () => {
      socket.emit('join', { country });
    });

    socket.on('status:changed', (ev: StatusEvent) => {
      setRequests(prev => prev.map(r => 
        r.id === ev.requestId ? { ...r, status: ev.new } : r
      ));
      
      if (ev.new === 'VALIDATING' || ev.new === 'SCORING') {
         addToast(`Evaluación iniciada para petición ${ev.requestId.substring(0,8)}...`, 'evaluating');
      } else if (ev.new === 'APPROVED' || ev.new === 'REJECTED') {
         addToast(`Evaluación finalizada: ${ev.new} para petición ${ev.requestId.substring(0,8)}...`, 'success');
      }

      // Add row to flashing state
      setFlashingRows(prev => {
        const newSet = new Set(prev);
        newSet.add(ev.requestId);
        return newSet;
      });
      // Remove flash after animation (1s)
      setTimeout(() => {
        setFlashingRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(ev.requestId);
          return newSet;
        });
      }, 1000);
    });

    return () => {
      socket.disconnect();
    };
  }, [country]);

  const handleNewRequest = (req: Partial<CreditRequest>) => {
    setRequests(prev => [req as CreditRequest, ...prev]);
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', minHeight: '80vh' }}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1>Credit Control Center</h1>
          <p>Mostrando las solicitudes en tiempo real</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Nueva Solicitud
        </button>
      </div>

      <div className="flex gap-4 mb-8">
        {['MX', 'CO', 'BR'].map(c => (
           <button 
             key={c}
             onClick={() => { setRequests([]); setLoading(true); setCountry(c); }}
             className={`btn ${country === c ? 'btn-primary' : 'btn-ghost'}`}
           >
             {c === 'MX' ? 'México (MX)' : c === 'CO' ? 'Colombia (CO)' : 'Brasil (BR)'}
           </button>
        ))}
      </div>

      {loading ? (
        <p>Conectando al stream de eventos...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Moneda</th>
                <th>Fecha</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={6} style={{textAlign: 'center'}}>No hay solicitudes recientes.</td></tr>
              )}
              {requests.map(req => (
                <tr 
                  key={req.id} 
                  className={flashingRows.has(req.id) ? 'flash-update' : ''}
                  onClick={() => setSelectedRequestId(req.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{req.id?.substring(0,8)}...</td>
                  <td style={{ fontWeight: 500 }}>{req.customerName}</td>
                  <td>${Number(req.amount).toLocaleString()}</td>
                  <td>{req.currency}</td>
                  <td>{new Date(req.created_at).toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${req.status.toLowerCase()}`}>
                      {req.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <ApplicationForm 
          country={country} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleNewRequest} 
        />
      )}

      {selectedRequestId && (
        <ApplicationDetail 
          requestId={selectedRequestId} 
          onClose={() => setSelectedRequestId(null)} 
        />
      )}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderLeft: `4px solid ${t.type === 'success' ? 'var(--success)' : 'var(--info)'}` }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
