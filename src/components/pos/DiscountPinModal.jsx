import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, RefreshCw, Check, X, Timer } from "lucide-react";

// Genera un PIN de 4 dígitos basado en el tiempo (cambia cada 2 minutos)
function generateDynamicPin() {
  const now = new Date();
  // Ventana de 2 minutos: cada vez que los minutos cambien de par a impar o viceversa
  const window2min = Math.floor(now.getTime() / (2 * 60 * 1000));
  // Seed basada en la ventana temporal
  const seed = window2min * 7919 + 1234567;
  const pin = ((seed % 9000) + 1000).toString();
  return pin;
}

function getSecondsUntilNextWindow() {
  const now = new Date();
  const windowMs = 2 * 60 * 1000;
  const elapsed = now.getTime() % windowMs;
  return Math.ceil((windowMs - elapsed) / 1000);
}

export default function DiscountPinModal({ onAuthorized, onClose }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(getSecondsUntilNextWindow());
  const [currentPin] = useState(generateDynamicPin());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getSecondsUntilNextWindow());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleVerify = () => {
    const validPin = generateDynamicPin();
    if (pin === validPin) {
      onAuthorized();
    } else {
      setError("PIN incorrecto. Solicita el PIN actual al administrador.");
      setPin("");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Autorización de Descuento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <p className="text-sm text-purple-700 mb-1">El PIN dinámico cambia cada 2 minutos</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Timer className="w-4 h-4 text-purple-500" />
              <span className="font-mono text-lg font-bold text-purple-700">{formatTime(timeLeft)}</span>
              <span className="text-xs text-purple-500">para el próximo cambio</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium mb-1">Para administradores:</p>
            <p className="text-xs text-amber-600">El PIN actual es: <span className="font-mono font-bold text-amber-800 text-lg">{currentPin}</span></p>
            <p className="text-xs text-amber-500 mt-1">Comparte este PIN con el vendedor verbalmente.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Ingresa el PIN de autorización:</p>
            <Input
              type="password"
              placeholder="****"
              value={pin}
              onChange={e => { setPin(e.target.value); setError(""); }}
              maxLength={4}
              className="text-center text-2xl font-mono tracking-widest h-14"
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            {error && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <X className="w-3 h-3" /> {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="gap-1">
            <X className="w-4 h-4" /> Cancelar
          </Button>
          <Button onClick={handleVerify} disabled={pin.length < 4} className="bg-purple-600 hover:bg-purple-700 gap-1">
            <Check className="w-4 h-4" /> Verificar PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}