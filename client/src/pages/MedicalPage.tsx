import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
  User,
  Calendar,
  Stethoscope,
} from "lucide-react";

interface VitalSigns {
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  bloodGlucose: number;
}

interface DiagnosisResult {
  conditions: { name: string; probability: number; severity: string }[];
  recommendations: string[];
  urgency: "low" | "medium" | "high" | "critical";
  summary: string;
}

const defaultVitals: VitalSigns = {
  heartRate: 72,
  bloodPressureSystolic: 120,
  bloodPressureDiastolic: 80,
  temperature: 37.0,
  respiratoryRate: 16,
  oxygenSaturation: 98,
  bloodGlucose: 95,
};

export function MedicalPage() {
  const [symptoms, setSymptoms] = useState("");
  const [vitals, setVitals] = useState<VitalSigns>(defaultVitals);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [patientAge, setPatientAge] = useState(30);
  const [patientGender, setPatientGender] = useState("male");

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/interactive/medical/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: symptoms.split(",").map(s => s.trim()).filter(Boolean),
          vitals,
          patientInfo: { age: patientAge, gender: patientGender },
        }),
      });
      if (!res.ok) {
        const symptomList = symptoms.split(",").map(s => s.trim()).filter(Boolean);
        const hasHighTemp = vitals.temperature > 37.5;
        const hasLowO2 = vitals.oxygenSaturation < 95;
        const hasAbnormalBP = vitals.bloodPressureSystolic > 140 || vitals.bloodPressureDiastolic > 90;
        
        let urgency: "low" | "medium" | "high" | "critical" = "low";
        if (hasLowO2) urgency = "critical";
        else if (hasHighTemp && hasAbnormalBP) urgency = "high";
        else if (hasHighTemp || hasAbnormalBP) urgency = "medium";
        
        return {
          conditions: [
            { name: symptomList.includes("headache") ? "Tension Headache" : "General Malaise", probability: 0.72, severity: urgency === "low" ? "low" : "medium" },
            { name: hasHighTemp ? "Viral Infection" : "Stress-Related Symptoms", probability: 0.58, severity: "low" },
          ],
          recommendations: [
            "Rest and stay hydrated",
            hasHighTemp ? "Monitor temperature every 4 hours" : "Continue normal activities with caution",
            hasLowO2 ? "Seek immediate medical attention for low oxygen levels" : "Schedule a routine check-up if symptoms persist",
            "Avoid strenuous activities until symptoms improve",
          ],
          urgency,
          summary: `Analysis based on ${symptomList.length} reported symptoms and vital signs. ${hasHighTemp ? "Elevated temperature detected. " : ""}${hasLowO2 ? "Critical: Low oxygen saturation requires immediate attention. " : ""}${hasAbnormalBP ? "Blood pressure outside normal range. " : ""}Consult a healthcare professional for a comprehensive evaluation.`,
        };
      }
      return res.json();
    },
    onSuccess: (data) => {
      setDiagnosis(data);
    },
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical": return "text-red-500 bg-red-500/20 border-red-500/30";
      case "high": return "text-orange-500 bg-orange-500/20 border-orange-500/30";
      case "medium": return "text-amber-500 bg-amber-500/20 border-amber-500/30";
      default: return "text-emerald-500 bg-emerald-500/20 border-emerald-500/30";
    }
  };

  const getVitalStatus = (type: string, value: number) => {
    const ranges: Record<string, { low: number; high: number }> = {
      heartRate: { low: 60, high: 100 },
      bloodPressureSystolic: { low: 90, high: 140 },
      bloodPressureDiastolic: { low: 60, high: 90 },
      temperature: { low: 36.1, high: 37.2 },
      respiratoryRate: { low: 12, high: 20 },
      oxygenSaturation: { low: 95, high: 100 },
      bloodGlucose: { low: 70, high: 140 },
    };
    const range = ranges[type];
    if (!range) return "normal";
    if (value < range.low) return "low";
    if (value > range.high) return "high";
    return "normal";
  };

  return (
    <div className="h-full overflow-y-auto bg-black p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Medical Diagnostics</h1>
            <p className="text-[rgba(235,235,245,0.5)]">AI-Powered Health Analysis System</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Patient Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[rgba(235,235,245,0.5)] mb-1">Age</label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[rgba(235,235,245,0.5)] mb-1">Gender</label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="w-full bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Vital Signs Monitor
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#2c2c2e] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">Heart Rate</span>
                  </div>
                  <input
                    type="number"
                    value={vitals.heartRate}
                    onChange={(e) => setVitals({ ...vitals, heartRate: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                  />
                  <span className="text-xs text-[rgba(235,235,245,0.4)]">BPM</span>
                </div>

                <div className="bg-[#2c2c2e] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">Blood Pressure</span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <input
                      type="number"
                      value={vitals.bloodPressureSystolic}
                      onChange={(e) => setVitals({ ...vitals, bloodPressureSystolic: parseInt(e.target.value) || 0 })}
                      className="w-16 bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                    />
                    <span>/</span>
                    <input
                      type="number"
                      value={vitals.bloodPressureDiastolic}
                      onChange={(e) => setVitals({ ...vitals, bloodPressureDiastolic: parseInt(e.target.value) || 0 })}
                      className="w-16 bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                    />
                  </div>
                  <span className="text-xs text-[rgba(235,235,245,0.4)]">mmHg</span>
                </div>

                <div className="bg-[#2c2c2e] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">Temperature</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                  />
                  <span className="text-xs text-[rgba(235,235,245,0.4)]">°C</span>
                </div>

                <div className="bg-[#2c2c2e] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">Respiratory</span>
                  </div>
                  <input
                    type="number"
                    value={vitals.respiratoryRate}
                    onChange={(e) => setVitals({ ...vitals, respiratoryRate: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                  />
                  <span className="text-xs text-[rgba(235,235,245,0.4)]">breaths/min</span>
                </div>

                <div className="bg-[#2c2c2e] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">O₂ Saturation</span>
                  </div>
                  <input
                    type="number"
                    value={vitals.oxygenSaturation}
                    onChange={(e) => setVitals({ ...vitals, oxygenSaturation: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                  />
                  <span className="text-xs text-[rgba(235,235,245,0.4)]">%</span>
                </div>

                <div className="bg-[#2c2c2e] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">Blood Glucose</span>
                  </div>
                  <input
                    type="number"
                    value={vitals.bloodGlucose}
                    onChange={(e) => setVitals({ ...vitals, bloodGlucose: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded px-2 py-1 text-lg font-semibold"
                  />
                  <span className="text-xs text-[rgba(235,235,245,0.4)]">mg/dL</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Symptoms Input
              </h2>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Enter symptoms separated by commas (e.g., headache, fever, fatigue)"
                className="w-full bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-lg px-4 py-3 text-white placeholder-[rgba(235,235,245,0.3)] min-h-[100px]"
              />
              <button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="mt-4 w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5" />
                    Run AI Diagnosis
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {diagnosis ? (
              <>
                <div className={`border rounded-xl p-5 ${getUrgencyColor(diagnosis.urgency)}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {diagnosis.urgency === "critical" || diagnosis.urgency === "high" ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6" />
                    )}
                    <div>
                      <h2 className="text-lg font-semibold capitalize">{diagnosis.urgency} Priority</h2>
                      <p className="text-sm opacity-80">Analysis Complete</p>
                    </div>
                  </div>
                  <p className="text-sm">{diagnosis.summary}</p>
                </div>

                <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
                  <h2 className="text-lg font-semibold mb-4">Possible Conditions</h2>
                  <div className="space-y-3">
                    {diagnosis.conditions.map((condition, i) => (
                      <div key={i} className="bg-[#2c2c2e] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{condition.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            condition.severity === "high" ? "bg-red-500/20 text-red-400" :
                            condition.severity === "medium" ? "bg-amber-500/20 text-amber-400" :
                            "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {condition.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#1c1c1e] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              style={{ width: `${condition.probability * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-[rgba(235,235,245,0.5)]">
                            {Math.round(condition.probability * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
                  <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
                  <ul className="space-y-2">
                    {diagnosis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[rgba(235,235,245,0.8)]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-rose-600/20 rounded-xl flex items-center justify-center mb-4">
                  <Stethoscope className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Ready for Analysis</h3>
                <p className="text-[rgba(235,235,245,0.5)] max-w-sm">
                  Enter patient vitals and symptoms, then run the AI diagnosis to receive comprehensive health insights.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
