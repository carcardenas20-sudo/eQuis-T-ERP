import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Copy, RefreshCw, Timer, Check } from "lucide-react";

function generateDynamicPin() {
  const now = new Date();
  const window2min = Math.floor(now.getTime() / (2 * 60 * 1000));
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

export default function DiscountPinManager() {
  const [currentPin, setCurrentPin] = useState(generateDynamicPin());
  const [timeLeft, setTimeLeft] = useState(getSecondsUntilNextWindow());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeLeft = getSecondsUntilNextWindow();
      setTimeLeft(newTimeLeft);
      
      // If we're crossing into a new 2-minute window, update the PIN
      if (newTimeLeft > 119) {
        setCurrentPin(generateDynamicPin());
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s) => {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(currentPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Autorización de Descuentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            Los vendedores necesitan este PIN para aplicar descuentos. El PIN cambia automáticamente cada 2 minutos.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-300 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-purple-600 font-medium mb-2">PIN Actual para Descuentos</p>
                <div className="flex items-center gap-3">
                  <div className="text-5xl font-mono font-bold text-purple-700 tracking-widest">{currentPin}</div>
                  <Button
                    onClick={handleCopyPin}
                    variant="outline"
                    size="sm"
                    className="border-purple-300 hover:bg-purple-200 h-12"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-purple-200">
              <Timer className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-purple-600">Tiempo hasta el próximo cambio:</p>
                <p className="font-mono text-lg font-bold text-purple-700">{formatTime(timeLeft)}</p>
              </div>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800 text-sm">
              <strong>Instrucción:</strong> Comparte este PIN con los vendedores de forma verbal o privada. Cambia automáticamente cada 2 minutos por seguridad.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-slate-600 text-xs font-medium mb-1">Intervalo de cambio</p>
              <p className="font-semibold text-slate-900">Cada 2 minutos</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-slate-600 text-xs font-medium mb-1">Uso</p>
              <p className="font-semibold text-slate-900">Autorizar descuentos</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}