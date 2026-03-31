
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";

export default function TutorialModal({ tutorial, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const progress = ((currentStep + 1) / tutorial.steps.length) * 100;
  const isLastStep = currentStep === tutorial.steps.length - 1;
  const isFirstStep = currentStep === 0;
  
  const currentStepData = tutorial.steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <tutorial.icon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">{tutorial.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{tutorial.category}</Badge>
                <span className="text-sm text-slate-500">
                  Paso {currentStep + 1} de {tutorial.steps.length}
                </span>
              </div>
            </div>
          </div>
          
          <Progress value={progress} className="h-2" />
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              {currentStepData.title}
            </h3>
            <p className="text-blue-800 leading-relaxed">
              {currentStepData.content}
            </p>
            
            {currentStepData.tip && (
              <div className="mt-4 bg-white border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Consejo:</p>
                    <p className="text-sm text-slate-600 mt-1">{currentStepData.tip}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visual placeholder OR actual image */}
          <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
            {currentStepData.imageUrl ? (
              <img
                src={currentStepData.imageUrl}
                alt={`Paso: ${currentStepData.title}`}
                className="w-full h-auto rounded-md shadow-lg object-contain max-h-[400px]"
              />
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <div className="text-slate-400 mb-2">
                  <tutorial.icon className="w-12 h-12 mx-auto mb-2" />
                </div>
                <p className="text-slate-500 text-sm">
                  Aquí se mostraría una captura de pantalla o video explicativo del paso
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={isFirstStep}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
          
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completar
                </>
              ) : (
                <>
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
