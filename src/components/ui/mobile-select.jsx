import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MobileSelect({ 
  value, 
  onValueChange, 
  placeholder, 
  options = [], 
  className 
}) {
  const [open, setOpen] = React.useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const selectedOption = options.find(opt => opt.value === value);

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile: use native select to avoid focus/overlay conflicts inside dialogs
  return (
    <div className={cn("w-full", className)}>
      <select
        className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        value={value || ""}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="" disabled>{placeholder || "Seleccionar"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}