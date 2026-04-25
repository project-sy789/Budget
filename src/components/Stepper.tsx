import React from 'react'

interface Step {
  number: number
  label: string
  icon?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export default function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div
            className={`stepper-item ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
            onClick={() => onStepClick && currentStep > step.number && onStepClick(step.number)}
            style={{ cursor: currentStep > step.number ? 'pointer' : 'default' }}
          >
            <div className="stepper-circle">
              {currentStep > step.number ? (
                <span>✓</span>
              ) : (
                <span>{step.icon || step.number}</span>
              )}
            </div>
            <div className="stepper-label">{step.label}</div>
          </div>
          {index < steps.length - 1 && (
            <div className={`stepper-line ${currentStep > step.number ? 'completed' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
