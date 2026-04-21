import React, { useState } from 'react';
import { CreditRequest } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: (newReq: Partial<CreditRequest>) => void;
  country: string;
}

export default function ApplicationForm({ onClose, onSuccess, country }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    docType: country === 'MX' ? 'CURP' : country === 'CO' ? 'CC' : 'CPF',
    docNumber: '',
    monthlyIncome: '',
    amount: '',
    currency: country === 'MX' ? 'MXN' : country === 'CO' ? 'COP' : 'BRL',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        country,
        customer: {
          fullName: formData.fullName,
          docType: formData.docType,
          docNumber: formData.docNumber,
          monthlyIncome: Number(formData.monthlyIncome),
        },
        amount: Number(formData.amount),
        currency: formData.currency,
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      onSuccess({
        id: data.requestId,
        status: data.status,
        country,
        amount: payload.amount,
        currency: payload.currency,
        customerName: payload.customer.fullName,
        created_at: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      alert('Error al crear solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <div className="flex justify-between items-center mb-6">
          <h2>Nueva Solicitud ({country})</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{padding: '0.25rem 0.5rem'}}>X</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre Completo</label>
            <input required className="form-input" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
          </div>
          
          <div className="flex gap-4 mb-4">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Tipo Doc.</label>
              <input readOnly disabled className="form-input" value={formData.docType} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Documento</label>
              <input required className="form-input" value={formData.docNumber} onChange={e => setFormData({...formData, docNumber: e.target.value})} />
            </div>
          </div>

          <div className="flex gap-4 mb-8">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Monto Solicitado</label>
              <input type="number" required className="form-input" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Ingreso Mensual</label>
              <input type="number" required className="form-input" value={formData.monthlyIncome} onChange={e => setFormData({...formData, monthlyIncome: e.target.value})} />
            </div>
          </div>
          
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Calculando...' : 'Enviar Evaluación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
