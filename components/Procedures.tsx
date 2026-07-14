import React, { useState } from 'react';
import { BookOpen, ChevronRight, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Procedure {
    id: string;
    title: string;
    category: string;
    content: string;
}

const procedures: Procedure[] = [
    {
        id: 'route_guide',
        title: 'Route Guide: Drug Administration',
        category: 'Pharmacology',
        content: `
### Common Administration Routes

#### Intravenous (IV)
- **Direct IV (Push)**: Rapid administration (e.g., Adenosine) or slow push (e.g., Morphine over 2-5 min).
  - *Safety*: Flush before and after. Check compatibility.
- **Intermittent Infusion (Piggyback)**: 50-250mL over 15-60 min (e.g., Antibiotics).
- **Continuous Infusion**: Large volume or precise titration (e.g., Norepinephrine). Requires pump.

#### Intramuscular (IM)
- **Deltoid**: Max 1 mL. Site: 2-3 finger widths below acromion process.
- **Vastus Lateralis**: Max 3 mL (adults). Preferred for infants.
- **Ventrogluteal**: Max 3 mL. Safest deep muscle site.
- *Technique*: Z-track method to prevent leakage. 90-degree angle.

#### Subcutaneous (SC)
- **Sites**: Abdomen (>2 inches from umbilicus), back of upper arm, anterior thigh.
- **Volume**: Max 1-1.5 mL.
- **Angle**: 45-90 degrees depending on tissue amount.

#### Intraosseous (IO)
- **Indication**: Emergency access when IV failed (2 attempts or 90 secs).
- **Sites**: Proximal tibia, Humeral head.
- **Contraindications**: Fracture in same bone, previous IO in 48h, infection at site.
- *Note*: Painful in conscious patients (Lidocaine flush required).
        `
    },
    {
        id: 'rsi',
        title: 'Rapid Sequence Intubation (RSI)',
        category: 'Airway',
        content: `
### 7 P's of RSI

1. **Preparation**: Assess airway (LEMON), IV access x2, Equipment check (SOAPME).
2. **Preoxygenation**: 100% O2 for 3-5 mins or 8 vital capacity breaths. Target SpO2 100%.
3. **Pretreatment** (Optional): Fentanyl (3 mcg/kg) for elevated ICP/cardiac ischemia.
4. **Paralysis with Induction**:
   - **Induction**: Etomidate (0.3 mg/kg) or Ketamine (1.5 mg/kg).
   - **Paralysis**: Rocuronium (1.2 mg/kg) or Succinylcholine (1.5 mg/kg).
5. **Positioning**: Sniffing position. Sternal notch aligned with external auditory meatus.
6. **Placement with Proof**: Intubate. Verify with EtCO2 (Gold Standard), auscultation.
7. **Post-intubation**: Secure tube, sedation, vent settings, CXR.
        `
    },
    {
        id: 'cvc',
        title: 'Central Venous Catheter (IJ)',
        category: 'Vascular Access',
        content: `
### Internal Jugular CVC Checklist

- **Consent**: Obtained and Time-out performed.
- **Position**: Trendelenburg. Head rotated slightly contralateral.
- **Ultrasound**: Verify vein compressibility and anatomy.
- **Sterile**: Full barrier precautions (gown, gloves, mask, cap, full drape).
- **Technique (Seldinger)**:
  1. Anesthetize skin with Lidocaine.
  2. Access vein under US guidance (needle tip visible).
  3. Confirm venous return (dark blood, non-pulsatile).
  4. Thread guidewire (must pass easily). Monitoring for arrhythmia.
  5. Incise skin at wire.
  6. Dilate tract (do not advance dilator too deep).
  7. Advance catheter over wire.
  8. **Remove wire** (Hold wire at all times!).
  9. Aspirate and flush all ports.
  10. Suture in place.
- **Confirmation**: CXR/US to rule out pneumothorax and confirm tip position.
        `
    },
    {
        id: 'chest_tube',
        title: 'Chest Tube Insertion (Tube Thoracostomy)',
        category: 'Trauma / Pulmonary',
        content: `
### Safe Triangle Zone
Bordered by:
- Anterior border of Latissimus Dorsi
- Lateral border of Pectoralis Major
- Line superior to the nipple (4th/5th intercostal space)

### Steps
1. **Position**: Supine, arm abducted above head.
2. **Anesthesia**: Generous local lidocaine (skin, subq, periosteum, pleura).
3. **Incision**: 2-3 cm incision parallel to rib, over the rib **below** the interspace target.
4. **Dissection**: Blunt dissect with Kelly clamp **over** the rib (avoid NV bundle under rib).
5. **Puncture**: Push clamp through parietal pleura ("pop"). Spread clamp.
6. **Sweep**: Insert finger, rotate 360 to break adhesions.
7. **Insertion**: Guide tube (clamped distal end) with clamp into space. Direct posterior/superior for air, posterior/inferior for fluid.
8. **Secure**: Suture and connect to pleurovac.
        `
    }
];

const Procedures: React.FC = () => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
            {/* Sidebar List */}
            <div className="md:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-bold text-slate-900 flex items-center">
                        <BookOpen className="h-5 w-5 mr-2 text-med-600" />
                        Procedure Guides
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {procedures.map((proc) => (
                        <button
                            key={proc.id}
                            onClick={() => setSelectedId(proc.id)}
                            className={`
                                w-full text-left p-3 rounded-lg flex justify-between items-center transition-all
                                ${selectedId === proc.id 
                                    ? 'bg-med-50 text-med-700 border border-med-200' 
                                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'}
                            `}
                        >
                            <div>
                                <div className="font-semibold text-sm">{proc.title}</div>
                                <div className="text-xs opacity-70">{proc.category}</div>
                            </div>
                            {selectedId === proc.id && <ChevronRight className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="md:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {selectedId ? (
                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="prose prose-slate max-w-none">
                            <ReactMarkdown>{procedures.find(p => p.id === selectedId)?.content || ''}</ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <FileText className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Select a procedure to view guide</p>
                        <p className="text-sm">Step-by-step instructions and safety checklists</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Procedures;