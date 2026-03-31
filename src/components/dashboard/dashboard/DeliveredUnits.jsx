import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CheckSquare, Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function DeliveredUnits({ deliveries }) {
  const [date, setDate] = useState({
    from: subDays(new Date(), 6), // Iniciar con los últimos 7 días
    to: new Date(),
  });
  const [totalUnits, setTotalUnits] = useState(0);
  const [operarioCount, setOperarioCount] = useState(0);

  useEffect(() => {
    if (!date?.from || !date?.to) {
      setTotalUnits(0);
      return;
    }

    // Para asegurar que el día final se incluya completo en el filtro
    const toDate = new Date(date.to);
    toDate.setHours(23, 59, 59, 999);

    const filteredDeliveries = deliveries.filter(d => {
      const deliveryDate = new Date(d.delivery_date);
      return deliveryDate >= date.from && deliveryDate <= toDate;
    });
    
    const sum = filteredDeliveries.reduce((acc, d) => {
      if (d.items && d.items.length > 0) {
        return acc + d.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }
      return acc + (d.quantity || 0);
    }, 0);
    const uniqueOperarios = new Set(filteredDeliveries.map(d => d.employee_id)).size;
    setTotalUnits(sum);
    setOperarioCount(uniqueOperarios);
  }, [date, deliveries]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            Unidades Entregadas
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className="w-full sm:w-auto justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Selecciona un rango</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold text-blue-700">{totalUnits.toLocaleString()}</p>
        {operarioCount > 0 && (
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-semibold text-slate-700">{operarioCount} operario{operarioCount !== 1 ? 's' : ''}</span>
            {' · Promedio: '}
            <span className="font-semibold text-slate-700">{Math.round(totalUnits / operarioCount).toLocaleString()} uds/operario</span>
          </p>
        )}
        <p className="text-sm text-slate-500 mt-0.5">
          Total de unidades entregadas en el período seleccionado.
        </p>
      </CardContent>
    </Card>
  );
}