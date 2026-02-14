import os
import io
import base64
import json
import numpy as np
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


class DetailedKnowledgeBase:
    def __init__(self):
        self.knowledge = self._load_knowledge()
        self.visual_topics = self._identify_visual_topics()

    def _load_knowledge(self) -> Dict:
        return {
            'pathogen': {
                'category': 'biology',
                'visual': True,
                'description': 'Disease-causing organism',
                'details': {
                    'definition': 'A pathogen is any organism that causes disease in a host. Pathogens can be viruses, bacteria, fungi, or parasites.',
                    'types': ['Virus', 'Bacteria', 'Fungus', 'Parasite', 'Prion'],
                    'transmission': ['Airborne', 'Waterborne', 'Bloodborne', 'Contact', 'Sexual'],
                    'characteristics': ['Size 0.1-300 micrometers', 'Genetic material (DNA/RNA)', 'Host specificity', 'Evolutionary adaptation'],
                    'examples': ['COVID-19 (SARS-CoV-2)', 'Influenza virus', 'Streptococcus bacteria', 'Candida fungus'],
                    'prevention': ['Vaccination', 'Hygiene', 'Quarantine', 'Antibiotic therapy', 'Antifungal therapy'],
                    'visual_aspects': ['Microscopic structure', 'Viral particles', 'Cell invasion', 'Immune response', 'Disease progression']
                }
            },
            'virus': {
                'category': 'biology',
                'visual': True,
                'description': 'Infectious agent of nucleic acid and protein',
                'details': {
                    'definition': 'A virus is a small infectious agent that replicates only inside host cells. It consists of genetic material surrounded by a protein coat.',
                    'structure': {
                        'genetic_material': 'DNA or RNA (single or double-stranded)',
                        'capsid': 'Protein shell surrounding genetic material',
                        'envelope': 'Lipid membrane in some viruses',
                        'spike_proteins': 'Protrusions for cell recognition'
                    },
                    'size': '20-300 nanometers',
                    'life_cycle': ['Attachment', 'Penetration', 'Uncoating', 'Replication', 'Assembly', 'Release'],
                    'notable_viruses': {
                        'COVID-19': {'size': '100nm', 'shape': 'Spherical', 'genome': 'RNA'},
                        'Influenza': {'size': '80-120nm', 'shape': 'Spherical', 'genome': 'RNA'},
                        'HIV': {'size': '100-120nm', 'shape': 'Spherical', 'genome': 'RNA'},
                        'Measles': {'size': '150-250nm', 'shape': 'Spherical', 'genome': 'RNA'}
                    },
                    'immune_response': ['Antibody production', 'T-cell activation', 'Interferon release', 'Inflammation'],
                    'treatments': ['Antivirals', 'Supportive care', 'Vaccination', 'Monoclonal antibodies']
                }
            },
            'bacteria': {
                'category': 'biology',
                'visual': True,
                'description': 'Single-celled prokaryotic organism',
                'details': {
                    'definition': 'Bacteria are microscopic, single-celled organisms with no nucleus. Most are harmless, some beneficial, few pathogenic.',
                    'structure': {
                        'cell_wall': 'Peptidoglycan layer',
                        'cell_membrane': 'Lipid bilayer',
                        'cytoplasm': 'Contains ribosomes',
                        'genetic_material': 'DNA in nucleoid region',
                        'flagella': 'Structures for movement',
                        'pili': 'Appendages for attachment'
                    },
                    'shapes': ['Cocci (spherical)', 'Bacilli (rod-shaped)', 'Spirilli (spiral)', 'Vibrio (comma-shaped)'],
                    'classification': ['Gram-positive', 'Gram-negative'],
                    'size': '0.5-5 micrometers',
                    'reproduction': 'Binary fission (asexual)',
                    'notable_pathogens': ['Streptococcus pyogenes', 'Staphylococcus aureus', 'Mycobacterium tuberculosis', 'Escherichia coli'],
                    'antibiotic_resistance': 'Increasing threat, mechanism of resistance'
                }
            },
            'covid-19': {
                'category': 'disease',
                'visual': True,
                'description': 'Coronavirus disease 2019',
                'details': {
                    'causative_agent': 'SARS-CoV-2 virus',
                    'discovery': 'December 2019, Wuhan, China',
                    'structure': {
                        'genome': 'Single-stranded RNA (29.9 kb)',
                        'proteins': 'Spike (S), Envelope (E), Membrane (M), Nucleocapsid (N)',
                        'spike_protein': 'Key for cell entry via ACE2 receptor',
                        'variants': 'Alpha, Beta, Gamma, Delta, Omicron with subvariants'
                    },
                    'transmission': ['Respiratory droplets', 'Aerosol (airborne)', 'Fomite (surface contact)'],
                    'incubation_period': '2-14 days',
                    'symptoms': {
                        'common': ['Fever', 'Cough', 'Fatigue', 'Loss of taste/smell'],
                        'moderate': ['Shortness of breath', 'Pneumonia', 'Hypoxia'],
                        'severe': ['Respiratory failure', 'Thrombosis', 'Multiorgan failure', 'Death']
                    },
                    'vaccines': ['mRNA (Pfizer, Moderna)', 'Viral vector (AstraZeneca)', 'Inactivated (Sinopharm, Sinovac)', 'Protein subunit (Novavax)'],
                    'treatments': ['Remdesivir', 'Dexamethasone', 'Monoclonal antibodies', 'Anticoagulants', 'Supportive care']
                }
            },
            'dna': {
                'category': 'biology',
                'visual': True,
                'description': 'Deoxyribonucleic acid - genetic material',
                'details': {
                    'definition': 'DNA is a molecule containing genetic instructions for life. It consists of four nucleotide bases: A, T, G, C.',
                    'structure': {
                        'double_helix': 'Two complementary strands wound around each other',
                        'base_pairing': 'A-T (2 bonds), G-C (3 bonds)',
                        'sugar_phosphate_backbone': 'Deoxyribose and phosphate groups',
                        'grooves': 'Major and minor grooves allow protein interaction'
                    },
                    'size': '3 billion base pairs in human genome',
                    'location': ['Nucleus', 'Mitochondria', 'Chloroplasts (in plants)'],
                    'functions': ['Genetic information storage', 'Gene expression control', 'DNA replication', 'Protein synthesis'],
                    'replication': 'Semi-conservative, semi-discontinuous, requires DNA polymerase',
                    'mutations': ['Point mutations', 'Insertions', 'Deletions', 'Translocations'],
                    'genetic_code': '64 codons code for 20 amino acids'
                }
            },
            'immune_system': {
                'category': 'biology',
                'visual': True,
                'description': "Body's defense system against pathogens",
                'details': {
                    'definition': 'The immune system is a complex network of cells and proteins that defend against infection and disease.',
                    'components': {
                        'innate_immunity': ['Physical barriers (skin, mucus)', 'Complement system', 'Macrophages', 'Neutrophils', 'Natural killer cells'],
                        'adaptive_immunity': ['B cells (antibody production)', 'T cells (cell-mediated immunity)', 'Memory cells', 'Regulatory T cells']
                    },
                    'organs': ['Bone marrow', 'Thymus', 'Spleen', 'Lymph nodes', "Peyer's patches", 'Tonsils'],
                    'immune_response': ['Antigen recognition', 'Immune cell activation', 'Cytokine production', 'Antibody synthesis', 'Cell destruction', 'Memory formation'],
                    'disorders': ['Immunodeficiency (HIV, AIDS)', 'Autoimmunity (lupus, rheumatoid arthritis)', 'Allergies', 'Inflammation'],
                    'enhancement': ['Vaccination', 'Proper nutrition', 'Exercise', 'Sleep', 'Stress reduction']
                }
            },
            'cancer': {
                'category': 'disease',
                'visual': True,
                'description': 'Abnormal cell growth and proliferation',
                'details': {
                    'definition': 'Cancer is a disease of uncontrolled cell growth caused by mutations in DNA.',
                    'hallmarks': ['Unlimited replication', 'Evasion of growth suppressors', 'Apoptosis resistance', 'Angiogenesis induction', 'Tissue invasion', 'Metastasis'],
                    'types': {
                        'carcinomas': 'From epithelial cells',
                        'sarcomas': 'From connective tissues',
                        'leukemias': 'From blood cells',
                        'lymphomas': 'From immune cells'
                    },
                    'common_cancers': ['Lung cancer', 'Breast cancer', 'Colorectal cancer', 'Prostate cancer', 'Melanoma', 'Leukemia'],
                    'risk_factors': ['Smoking', 'UV exposure', 'Alcohol', 'Viral infections (HPV, HBV)', 'Genetic predisposition', 'Obesity'],
                    'treatments': ['Surgery', 'Chemotherapy', 'Radiation', 'Immunotherapy', 'Targeted therapy', 'Hormone therapy']
                }
            },
            'heart': {
                'category': 'anatomy',
                'visual': True,
                'description': 'Muscular organ pumping blood',
                'details': {
                    'definition': 'The heart is a muscular organ that pumps blood throughout the body via the circulatory system.',
                    'structure': {
                        'chambers': ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'],
                        'valves': ['Tricuspid valve', 'Pulmonary valve', 'Mitral (bicuspid) valve', 'Aortic valve'],
                        'walls': ['Epicardium', 'Myocardium', 'Endocardium'],
                        'blood_vessels': ['Aorta', 'Superior/inferior vena cava', 'Pulmonary artery', 'Pulmonary vein']
                    },
                    'size': 'About 15 cm long, 10 cm wide, weighs 250-350g',
                    'heart_rate': '60-100 bpm at rest',
                    'cardiac_cycle': ['Systole (contraction)', 'Diastole (relaxation)'],
                    'common_diseases': ['Coronary artery disease', 'Heart attack', 'Arrhythmia', 'Heart failure', 'Valve disease'],
                    'electrical_system': ['SA node', 'AV node', 'Bundle of His', 'Purkinje fibers']
                }
            },
            'brain': {
                'category': 'anatomy',
                'visual': True,
                'description': 'Control center of nervous system',
                'details': {
                    'definition': 'The brain is the central organ of the nervous system, controlling thought, movement, sensation, and emotion.',
                    'major_regions': {
                        'cerebrum': 'Largest part, controls voluntary movement and thinking',
                        'cerebellum': 'Coordination and balance',
                        'brainstem': 'Vital functions (breathing, heart rate)',
                        'limbic_system': 'Emotion and memory'
                    },
                    'lobes': ['Frontal (decision-making)', 'Parietal (sensation)', 'Temporal (hearing, memory)', 'Occipital (vision)'],
                    'cells': ['Neurons (signaling)', 'Glial cells (support)'],
                    'neurotransmitters': ['Dopamine', 'Serotonin', 'GABA', 'Glutamate', 'Acetylcholine', 'Norepinephrine'],
                    'neuroplasticity': 'Ability to form new connections throughout life',
                    'disorders': ["Alzheimer's disease", "Parkinson's disease", 'Epilepsy', 'Stroke', 'Traumatic brain injury']
                }
            },
            'lung': {
                'category': 'anatomy',
                'visual': True,
                'description': 'Respiratory organs for gas exchange',
                'details': {
                    'definition': 'Lungs are organs of the respiratory system responsible for oxygen intake and carbon dioxide removal.',
                    'structure': {
                        'trachea': 'Windpipe carrying air to lungs',
                        'bronchi': 'Branch from trachea',
                        'bronchioles': 'Smaller branches',
                        'alveoli': 'Tiny air sacs for gas exchange'
                    },
                    'capacity': '3-3.5 liters for women, 3.5-4.8 liters for men',
                    'surface_area': '70 square meters (like a tennis court)',
                    'respiration': {
                        'inhalation': 'Diaphragm contracts, air enters',
                        'exhalation': 'Diaphragm relaxes, air exits',
                        'gas_exchange': 'O2 in, CO2 out in alveoli'
                    },
                    'common_diseases': ['Pneumonia', 'COPD', 'Asthma', 'Cystic fibrosis', 'Lung cancer', 'COVID-19 pneumonia']
                }
            },
            'cell': {
                'category': 'biology',
                'visual': True,
                'description': 'Basic unit of life',
                'details': {
                    'definition': 'A cell is the basic structural and functional unit of all living organisms.',
                    'types': ['Prokaryotic (no nucleus)', 'Eukaryotic (has nucleus)'],
                    'organelles': {
                        'nucleus': 'Contains DNA, controls cell activities',
                        'mitochondria': 'Powerhouse of the cell, produces ATP',
                        'endoplasmic_reticulum': 'Protein and lipid synthesis',
                        'golgi_apparatus': 'Packaging and shipping proteins',
                        'ribosomes': 'Protein synthesis',
                        'lysosomes': 'Cellular digestion'
                    },
                    'cell_membrane': 'Selectively permeable phospholipid bilayer',
                    'cell_division': ['Mitosis (body cells)', 'Meiosis (sex cells)'],
                    'functions': ['Energy production', 'Protein synthesis', 'Cell division', 'Signal transduction']
                }
            },
            'muscle': {
                'category': 'anatomy',
                'visual': True,
                'description': 'Tissue that produces force and motion',
                'details': {
                    'definition': 'Muscle tissue is responsible for movement, posture, and generating heat in the body.',
                    'types': {
                        'skeletal': 'Voluntary movement, attached to bones',
                        'cardiac': 'Involuntary, found only in the heart',
                        'smooth': 'Involuntary, found in organs and blood vessels'
                    },
                    'structure': ['Muscle fibers', 'Myofibrils', 'Sarcomeres', 'Actin and myosin filaments'],
                    'contraction': 'Sliding filament theory - actin slides over myosin',
                    'energy_sources': ['ATP', 'Creatine phosphate', 'Glycogen', 'Fatty acids'],
                    'disorders': ['Muscular dystrophy', 'Myasthenia gravis', 'Fibromyalgia', 'Rhabdomyolysis']
                }
            },
            'nervous_system': {
                'category': 'anatomy',
                'visual': True,
                'description': 'Body communication and control network',
                'details': {
                    'definition': 'The nervous system coordinates actions and transmits signals between different parts of the body.',
                    'divisions': {
                        'central_nervous_system': 'Brain and spinal cord',
                        'peripheral_nervous_system': 'Cranial and spinal nerves',
                        'autonomic_nervous_system': 'Sympathetic and parasympathetic'
                    },
                    'neurons': {
                        'sensory': 'Carry signals from receptors to CNS',
                        'motor': 'Carry signals from CNS to muscles',
                        'interneurons': 'Connect neurons within CNS'
                    },
                    'signal_transmission': 'Electrical impulses and chemical neurotransmitters',
                    'reflexes': 'Automatic responses to stimuli',
                    'disorders': ['Multiple sclerosis', 'ALS', 'Neuropathy', 'Meningitis']
                }
            }
        }

    def _identify_visual_topics(self) -> List[str]:
        return [topic for topic, data in self.knowledge.items() if data.get('visual', False)]

    def get_detailed_response(self, topic: str) -> Optional[Dict]:
        if topic.lower() in self.knowledge:
            return self.knowledge[topic.lower()]
        for key in self.knowledge.keys():
            if topic.lower() in key.lower() or key.lower() in topic.lower():
                return self.knowledge[key]
        return None

    def needs_visual(self, topic: str) -> bool:
        return topic.lower() in self.visual_topics or any(
            topic.lower() in t or t in topic.lower() for t in self.visual_topics
        )


class ImageGenerator:
    def __init__(self):
        self.cache_dir = Path("generated_images")
        self.cache_dir.mkdir(exist_ok=True)

    def generate_image(self, prompt: str, topic: str = "") -> Dict:
        try:
            return self._generate_custom_visualization(prompt, topic)
        except Exception as e:
            logger.error(f"Image generation error: {e}")
            return self._generate_fallback_image(topic)

    def _generate_custom_visualization(self, prompt: str, topic: str) -> Dict:
        topic_lower = topic.lower()
        dispatch = {
            'virus': self._create_virus_visualization,
            'bacteria': self._create_bacteria_visualization,
            'dna': self._create_dna_visualization,
            'covid': self._create_covid_visualization,
            'coronavirus': self._create_covid_visualization,
            'cell': self._create_cell_visualization,
            'heart': self._create_heart_visualization,
            'brain': self._create_brain_visualization,
            'lung': self._create_lung_visualization,
            'cancer': self._create_cancer_visualization,
            'immune': self._create_immune_visualization,
            'muscle': self._create_muscle_visualization,
            'pathogen': self._create_virus_visualization,
            'nervous': self._create_brain_visualization,
        }

        creator = None
        for key, func in dispatch.items():
            if key in topic_lower:
                creator = func
                break

        if creator:
            image = creator()
        else:
            image = self._create_generic_visualization(prompt)

        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{topic_lower.replace(' ', '_')}.png"
        filepath = self.cache_dir / filename
        image.save(filepath)

        img_base64 = self._image_to_base64(image)

        return {
            'success': True,
            'method': 'custom_visualization',
            'prompt': prompt,
            'topic': topic,
            'filepath': str(filepath),
            'base64': img_base64,
            'timestamp': datetime.now().isoformat()
        }

    def _create_virus_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 120, 15), "VIRUS STRUCTURE", fill='#00d4ff')
        draw.text((width//2 - 180, 40), "Quantum Intelligence Nexus v3.0 Visual", fill='#4a5568')

        center_x, center_y = width // 2, height // 2 + 20

        draw.ellipse([center_x-55, center_y-55, center_x+55, center_y+55], fill='#dc2626', outline='#ef4444', width=3)
        draw.text((center_x-35, center_y-15), "RNA/DNA", fill='white')
        draw.text((center_x-25, center_y+2), "Core", fill='white')

        draw.ellipse([center_x-105, center_y-105, center_x+105, center_y+105], outline='#3b82f6', width=3)
        draw.text((center_x-80, center_y-135), "Protein Capsid", fill='#60a5fa')

        for angle in range(0, 360, 30):
            rad = np.radians(angle)
            x1 = center_x + 105 * np.cos(rad)
            y1 = center_y + 105 * np.sin(rad)
            x2 = center_x + 150 * np.cos(rad)
            y2 = center_y + 150 * np.sin(rad)
            draw.line([(x1, y1), (x2, y2)], fill='#22c55e', width=3)
            draw.ellipse([x2-8, y2-8, x2+8, y2+8], fill='#16a34a')

        draw.text((50, height-80), "Spike Proteins: Cell entry mechanism", fill='#22c55e')
        draw.text((50, height-55), "Capsid: Protective protein shell", fill='#3b82f6')
        draw.text((50, height-30), "Core: Genetic material (DNA/RNA)", fill='#ef4444')

        return image

    def _create_bacteria_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 100, 15), "BACTERIAL CELL", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 20

        draw.ellipse([center_x-130, center_y-85, center_x+130, center_y+85], outline='#a855f7', width=4)
        draw.text((center_x-60, center_y-110), "Cell Wall", fill='#a855f7')

        draw.ellipse([center_x-120, center_y-75, center_x+120, center_y+75], outline='#3b82f6', width=2)

        draw.ellipse([center_x-115, center_y-70, center_x+115, center_y+70], fill='#1a1a2e')

        draw.ellipse([center_x-45, center_y-35, center_x+45, center_y+35], fill='#f97316', outline='#ea580c', width=2)
        draw.text((center_x-30, center_y-15), "DNA", fill='white')
        draw.text((center_x-38, center_y+2), "Nucleoid", fill='white')

        for i in range(8):
            x = center_x - 90 + i * 25
            y = center_y + 45 + (i % 2) * 12
            draw.ellipse([x-4, y-4, x+4, y+4], fill='#ef4444')
        draw.text((center_x-80, center_y+75), "Ribosomes", fill='#ef4444')

        draw.line([(center_x+130, center_y), (center_x+200, center_y-50)], fill='#22c55e', width=3)
        draw.line([(center_x+200, center_y-50), (center_x+240, center_y-30)], fill='#22c55e', width=3)
        draw.text((center_x+150, center_y-70), "Flagellum", fill='#22c55e')

        for i in range(4):
            x = center_x - 80 + i * 40
            y = center_y - 75
            draw.line([(x, y), (x, y-25)], fill='#eab308', width=2)
        draw.text((center_x-50, center_y-120), "Pili", fill='#eab308')

        return image

    def _create_dna_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 120, 15), "DNA DOUBLE HELIX", fill='#00d4ff')

        center_x = width // 2
        y_start = 80
        helix_height = 420
        helix_width = 120

        base_colors = {'A-T': '#ef4444', 'G-C': '#22c55e'}
        pair_idx = 0

        for y in range(y_start, y_start + helix_height, 8):
            t = (y - y_start) / helix_height
            x1 = center_x - helix_width * np.cos(t * 8 * np.pi)
            draw.ellipse([x1-4, y-4, x1+4, y+4], fill='#3b82f6')
            x2 = center_x + helix_width * np.cos(t * 8 * np.pi)
            draw.ellipse([x2-4, y-4, x2+4, y+4], fill='#ef4444')

            if y % 24 == 0:
                color = '#22c55e' if pair_idx % 2 == 0 else '#eab308'
                draw.line([(x1, y), (x2, y)], fill=color, width=2)
                pair_idx += 1

        draw.text((30, 250), "Sugar-Phosphate\nBackbone\n(Blue strand)", fill='#3b82f6')
        draw.text((width-220, 250), "Sugar-Phosphate\nBackbone\n(Red strand)", fill='#ef4444')
        draw.text((center_x-80, height-60), "Base Pairs: A-T, G-C", fill='#22c55e')
        draw.text((center_x-120, height-35), "3 billion base pairs in human genome", fill='#64748b')

        return image

    def _create_covid_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 180, 15), "SARS-CoV-2 VIRUS PARTICLE", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 20

        draw.ellipse([center_x-85, center_y-85, center_x+85, center_y+85], fill='#1e3a5f', outline='#2563eb', width=3)

        draw.ellipse([center_x-35, center_y-35, center_x+35, center_y+35], fill='#f97316', outline='#ea580c', width=2)
        draw.text((center_x-18, center_y-10), "RNA", fill='white')

        num_spikes = 18
        for i in range(num_spikes):
            angle = 2 * np.pi * i / num_spikes
            x1 = center_x + 85 * np.cos(angle)
            y1 = center_y + 85 * np.sin(angle)
            x2 = center_x + 135 * np.cos(angle)
            y2 = center_y + 135 * np.sin(angle)
            draw.line([(x1, y1), (x2, y2)], fill='#dc2626', width=4)
            draw.ellipse([x2-12, y2-12, x2+12, y2+12], fill='#991b1b')

        draw.text((50, height-90), "S (Spike) Protein: Binds to ACE2 receptors", fill='#dc2626')
        draw.text((50, height-65), "Lipid Envelope: Protective membrane", fill='#2563eb')
        draw.text((50, height-40), "RNA Genome: ~30 kb single-stranded", fill='#f97316')
        draw.text((width-250, height-30), "Size: ~100-140 nm", fill='#64748b')

        return image

    def _create_cell_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 120, 15), "EUKARYOTIC CELL", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 20

        draw.ellipse([center_x-160, center_y-125, center_x+160, center_y+125], fill='#1a1a2e', outline='#6366f1', width=3)

        draw.ellipse([center_x-65, center_y-65, center_x+65, center_y+65], fill='#312e81', outline='#f97316', width=3)
        draw.ellipse([center_x-20, center_y-20, center_x+20, center_y+20], fill='#ef4444')
        draw.text((center_x-50, center_y+70), "NUCLEUS", fill='#f97316')

        positions = [(-110, -60), (110, -60), (-110, 60), (110, 60)]
        for i, (dx, dy) in enumerate(positions):
            x, y = center_x + dx, center_y + dy
            draw.ellipse([x-28, y-18, x+28, y+18], fill='#166534', outline='#22c55e', width=2)
            if i == 0:
                draw.text((x-45, y+25), "Mitochondria", fill='#22c55e')

        for i in range(6):
            x = center_x - 130 + i * 50
            y = center_y - 100
            draw.ellipse([x-5, y-5, x+5, y+5], fill='#a855f7')
        draw.text((center_x-50, center_y-125), "Ribosomes", fill='#a855f7')

        draw.rectangle([center_x-40, center_y+80, center_x+40, center_y+105], outline='#eab308', width=2)
        draw.text((center_x-55, center_y+110), "Golgi Apparatus", fill='#eab308')

        return image

    def _create_heart_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 110, 15), "HEART ANATOMY", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 20

        draw.ellipse([center_x-130, center_y-110, center_x-50, center_y-30], fill='#1e40af', outline='#3b82f6', width=2)
        draw.text((center_x-105, center_y-80), "LA", fill='white')

        draw.ellipse([center_x+50, center_y-110, center_x+130, center_y-30], fill='#1e40af', outline='#3b82f6', width=2)
        draw.text((center_x+80, center_y-80), "RA", fill='white')

        draw.polygon([(center_x-100, center_y-10), (center_x-40, center_y-10),
                       (center_x-50, center_y+110), (center_x-120, center_y+110)],
                      fill='#991b1b', outline='#dc2626')
        draw.text((center_x-90, center_y+40), "LV", fill='white')

        draw.polygon([(center_x+40, center_y-10), (center_x+100, center_y-10),
                       (center_x+120, center_y+110), (center_x+50, center_y+110)],
                      fill='#7f1d1d', outline='#ef4444')
        draw.text((center_x+65, center_y+40), "RV", fill='white')

        draw.line([(center_x-90, center_y-130), (center_x-70, center_y-170)], fill='#1d4ed8', width=4)
        draw.text((center_x-160, center_y-190), "Pulmonary\nVeins", fill='#3b82f6')

        draw.line([(center_x+90, center_y-130), (center_x+70, center_y-170)], fill='#1e3a5f', width=4)
        draw.text((center_x+80, center_y-190), "SVC/IVC\n(Deoxy)", fill='#64748b')

        draw.line([(center_x-70, center_y-10), (center_x-140, center_y-60)], fill='#dc2626', width=4)
        draw.text((center_x-250, center_y-70), "Aorta\n(Oxygenated)", fill='#dc2626')

        draw.text((50, height-60), "LA=Left Atrium | RA=Right Atrium", fill='#64748b')
        draw.text((50, height-35), "LV=Left Ventricle | RV=Right Ventricle", fill='#64748b')

        return image

    def _create_brain_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 120, 15), "BRAIN STRUCTURE", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 30

        draw.ellipse([center_x-100, center_y-110, center_x+100, center_y+110], outline='#a855f7', width=3)

        draw.line([(center_x, center_y-110), (center_x, center_y+110)], fill='#7c3aed', width=2)

        draw.text((center_x-80, center_y-90), "FRONTAL", fill='#ef4444')
        draw.text((center_x+20, center_y-90), "PARIETAL", fill='#22c55e')
        draw.text((center_x-80, center_y+30), "TEMPORAL", fill='#3b82f6')
        draw.text((center_x+20, center_y+30), "OCCIPITAL", fill='#f97316')

        draw.ellipse([center_x-45, center_y+100, center_x+45, center_y+140], fill='#166534', outline='#22c55e', width=2)
        draw.text((center_x-40, center_y+110), "Cerebellum", fill='white')

        draw.rectangle([center_x-12, center_y+90, center_x+12, center_y+165], fill='#713f12', outline='#eab308', width=2)
        draw.text((center_x-40, center_y+170), "Brainstem", fill='#eab308')

        draw.text((50, height-80), "Frontal: Decision & Motor | Parietal: Sensation", fill='#ef4444')
        draw.text((50, height-55), "Temporal: Hearing & Memory | Occipital: Vision", fill='#3b82f6')
        draw.text((50, height-30), "Cerebellum: Coordination | Brainstem: Vital Functions", fill='#22c55e')

        return image

    def _create_lung_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 100, 15), "LUNG ANATOMY", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 20

        draw.rectangle([center_x-8, center_y-180, center_x+8, center_y-100], fill='#475569', outline='#94a3b8', width=2)
        draw.text((center_x+15, center_y-160), "Trachea", fill='#94a3b8')

        draw.line([(center_x, center_y-100), (center_x-80, center_y-50)], fill='#475569', width=4)
        draw.line([(center_x, center_y-100), (center_x+80, center_y-50)], fill='#475569', width=4)

        draw.ellipse([center_x-170, center_y-80, center_x-30, center_y+120], fill='#1e293b', outline='#ef4444', width=2)
        draw.text((center_x-130, center_y+10), "Left\nLung", fill='#fca5a5')

        draw.ellipse([center_x+30, center_y-80, center_x+170, center_y+120], fill='#1e293b', outline='#dc2626', width=2)
        draw.text((center_x+70, center_y+10), "Right\nLung", fill='#fca5a5')

        draw.arc([center_x-190, center_y+100, center_x+190, center_y+160], 0, 180, fill='#f97316', width=3)
        draw.text((center_x-50, center_y+165), "Diaphragm", fill='#f97316')

        draw.ellipse([center_x-25, center_y-40, center_x+25, center_y+10], fill='#991b1b', outline='#dc2626', width=2)
        draw.text((center_x-18, center_y-22), "Heart", fill='white')

        draw.text((50, height-55), "Gas Exchange: O2 in, CO2 out via 300M+ alveoli", fill='#64748b')
        draw.text((50, height-30), "Surface Area: ~70 sq meters (tennis court)", fill='#64748b')

        return image

    def _create_cancer_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 150, 15), "CANCER CELL BIOLOGY", fill='#00d4ff')

        center_x, center_y = width // 2, height // 2 + 20

        draw.ellipse([center_x-80, center_y-80, center_x+80, center_y+80], fill='#1a1a2e', outline='#dc2626', width=3)
        draw.ellipse([center_x-40, center_y-40, center_x+40, center_y+40], fill='#312e81', outline='#f97316', width=2)
        draw.text((center_x-30, center_y-10), "Mutated\n DNA", fill='#fca5a5')

        for i in range(6):
            angle = i * 60
            rad = np.radians(angle)
            x = center_x + 120 * np.cos(rad)
            y = center_y + 120 * np.sin(rad)
            size = 15 + (i % 3) * 8
            draw.ellipse([x-size, y-size, x+size, y+size], fill='#7f1d1d', outline='#ef4444', width=1)

        draw.text((50, height-100), "Hallmarks of Cancer:", fill='#dc2626')
        draw.text((50, height-75), "1. Unlimited replication  2. Evasion of suppressors", fill='#94a3b8')
        draw.text((50, height-50), "3. Apoptosis resistance  4. Angiogenesis", fill='#94a3b8')
        draw.text((50, height-25), "5. Tissue invasion  6. Metastasis", fill='#94a3b8')

        return image

    def _create_immune_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 140, 15), "IMMUNE SYSTEM", fill='#00d4ff')

        y_base = 100
        draw.text((100, y_base), "INNATE IMMUNITY", fill='#f97316')
        draw.text((450, y_base), "ADAPTIVE IMMUNITY", fill='#22c55e')

        innate = ["Skin Barrier", "Macrophages", "Neutrophils", "NK Cells", "Complement"]
        for i, item in enumerate(innate):
            y = y_base + 40 + i * 35
            draw.ellipse([100, y, 130, y+25], fill='#f97316', outline='#ea580c', width=1)
            draw.text((140, y+3), item, fill='#fdba74')

        adaptive = ["B Cells", "T Helper Cells", "Cytotoxic T", "Memory Cells", "Antibodies"]
        for i, item in enumerate(adaptive):
            y = y_base + 40 + i * 35
            draw.ellipse([450, y, 480, y+25], fill='#22c55e', outline='#16a34a', width=1)
            draw.text((490, y+3), item, fill='#86efac')

        draw.line([(350, y_base+40), (350, y_base+200)], fill='#64748b', width=2)

        draw.text((50, height-55), "Innate: First responders, fast, non-specific", fill='#f97316')
        draw.text((50, height-30), "Adaptive: Targeted, memory, antibody production", fill='#22c55e')

        return image

    def _create_muscle_visualization(self) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        draw.text((width//2 - 130, 15), "MUSCLE TISSUE TYPES", fill='#00d4ff')

        labels = [
            ("SKELETAL", "Voluntary, striated", '#ef4444'),
            ("CARDIAC", "Involuntary, branched", '#f97316'),
            ("SMOOTH", "Involuntary, non-striated", '#22c55e')
        ]

        for i, (name, desc, color) in enumerate(labels):
            x = 80 + i * 250
            y = 100
            draw.rectangle([x, y, x+200, y+120], outline=color, width=2)
            draw.text((x+10, y+10), name, fill=color)
            draw.text((x+10, y+40), desc, fill='#94a3b8')
            for j in range(5):
                draw.line([(x+20, y+70+j*8), (x+180, y+70+j*8)], fill=color, width=2)

        draw.text((50, height-55), "Contraction: Sliding filament theory (actin + myosin)", fill='#64748b')
        draw.text((50, height-30), "Energy: ATP, Creatine Phosphate, Glycogen", fill='#64748b')

        return image

    def _create_generic_visualization(self, prompt: str) -> Image.Image:
        width, height = 800, 600
        image = Image.new('RGB', (width, height), '#0a0e1a')
        draw = ImageDraw.Draw(image)

        title = prompt[:50].upper() if len(prompt) > 50 else prompt.upper()
        draw.text((width//2 - 150, 15), title, fill='#00d4ff')

        for i in range(5):
            x = 80 + i * 140
            y = 150
            draw.ellipse([x-30, y-30, x+30, y+30], outline='#3b82f6', width=2)
            draw.text((x-10, y-8), str(i+1), fill='#60a5fa')

        for i in range(4):
            x1 = 110 + i * 140
            x2 = 190 + i * 140
            draw.line([(x1, 150), (x2, 150)], fill='#22c55e', width=2)

        draw.rectangle([50, 250, 750, 480], outline='#1e293b', width=1)
        draw.text((80, 270), "Scientific Concept Visualization", fill='#00d4ff')
        draw.text((80, 310), "Component Analysis:", fill='#94a3b8')
        draw.text((100, 340), "1. Structural elements and composition", fill='#64748b')
        draw.text((100, 370), "2. Functional relationships and interactions", fill='#64748b')
        draw.text((100, 400), "3. Systemic behavior and dynamics", fill='#64748b')
        draw.text((100, 430), "4. Clinical significance and applications", fill='#64748b')

        return image

    def _generate_fallback_image(self, topic: str) -> Dict:
        image = Image.new('RGB', (800, 600), '#0a0e1a')
        draw = ImageDraw.Draw(image)
        draw.text((150, 250), f"Visual: {topic}", fill='#00d4ff')
        draw.text((150, 300), "Detailed visualization pending", fill='#64748b')

        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_fallback.png"
        filepath = self.cache_dir / filename
        image.save(filepath)
        img_base64 = self._image_to_base64(image)

        return {
            'success': False,
            'method': 'fallback',
            'topic': topic,
            'filepath': str(filepath),
            'base64': img_base64,
            'message': 'Fallback image provided'
        }

    @staticmethod
    def _image_to_base64(image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"


class MultiModalResponseGenerator:
    def __init__(self):
        self.knowledge_base = DetailedKnowledgeBase()
        self.image_generator = ImageGenerator()
        logger.info("[Visual Engine] Multi-Modal Response Generator initialized")

    def generate_response(self, query: str) -> Dict:
        topic = self._extract_topic(query)
        knowledge = self.knowledge_base.get_detailed_response(topic)

        if knowledge is None:
            return {
                'success': False,
                'query': query,
                'topic': topic,
                'is_visual_topic': False,
                'text_response': None,
                'visual': None,
                'timestamp': datetime.now().isoformat()
            }

        needs_visual = self.knowledge_base.needs_visual(topic)
        text_response = self._generate_detailed_text(knowledge, topic)

        visual_response = None
        if needs_visual:
            visual_response = self.image_generator.generate_image(
                self._create_visual_prompt(knowledge, topic),
                topic
            )

        return {
            'success': True,
            'topic': topic,
            'text_response': text_response,
            'visual': visual_response,
            'timestamp': datetime.now().isoformat(),
            'is_visual_topic': needs_visual,
            'knowledge_coverage': len(knowledge.get('details', {}))
        }

    def detect_visual_topic(self, query: str) -> Dict:
        topic = self._extract_topic(query)
        needs_visual = self.knowledge_base.needs_visual(topic)
        knowledge = self.knowledge_base.get_detailed_response(topic)

        return {
            'detected': needs_visual and knowledge is not None,
            'topic': topic,
            'category': knowledge.get('category', 'unknown') if knowledge else 'unknown',
            'has_knowledge': knowledge is not None
        }

    def generate_visual_only(self, topic: str) -> Dict:
        knowledge = self.knowledge_base.get_detailed_response(topic)
        prompt = self._create_visual_prompt(knowledge, topic) if knowledge else topic
        return self.image_generator.generate_image(prompt, topic)

    def _extract_topic(self, query: str) -> str:
        query_lower = query.lower()

        for known_topic in sorted(self.knowledge_base.knowledge.keys(), key=len, reverse=True):
            if known_topic.replace('_', ' ') in query_lower or known_topic in query_lower:
                return known_topic

        topic_keywords = {
            'coronavirus': 'covid-19', 'sars': 'covid-19', 'covid': 'covid-19',
            'gene': 'dna', 'genetic': 'dna', 'genome': 'dna', 'chromosome': 'dna',
            'antibody': 'immune_system', 'immunity': 'immune_system', 'immune': 'immune_system',
            'vaccine': 'immune_system', 'lymphocyte': 'immune_system',
            'tumor': 'cancer', 'oncology': 'cancer', 'carcinoma': 'cancer', 'malignant': 'cancer',
            'cardiac': 'heart', 'cardiovascular': 'heart', 'artery': 'heart', 'ventricle': 'heart',
            'neuron': 'brain', 'neural': 'brain', 'cerebral': 'brain', 'cortex': 'brain',
            'respiratory': 'lung', 'breathing': 'lung', 'alveoli': 'lung', 'pulmonary': 'lung',
            'mitochondria': 'cell', 'organelle': 'cell', 'cytoplasm': 'cell', 'eukaryotic': 'cell',
            'germ': 'pathogen', 'infection': 'pathogen', 'microbe': 'pathogen',
            'bicep': 'muscle', 'skeletal': 'muscle', 'myocyte': 'muscle',
            'nerve': 'nervous_system', 'spinal': 'nervous_system', 'synapse': 'nervous_system',
            'strep': 'bacteria', 'staph': 'bacteria', 'e.coli': 'bacteria', 'antibiotic': 'bacteria',
            'flu': 'virus', 'hiv': 'virus', 'ebola': 'virus', 'measles': 'virus',
        }

        for keyword, mapped_topic in topic_keywords.items():
            if keyword in query_lower:
                return mapped_topic

        words = query.split()
        return max(words, key=len).lower() if words else "general"

    def _generate_detailed_text(self, knowledge: Dict, topic: str) -> Dict:
        details = knowledge.get('details', {})

        response = {
            'title': f"{topic.upper().replace('_', ' ')}",
            'category': knowledge.get('category', 'general'),
            'brief': knowledge.get('description', ''),
            'sections': {}
        }

        for key, value in details.items():
            response['sections'][key] = self._format_section(key, value)

        response['key_points'] = self._extract_key_points(knowledge)

        return response

    def _format_section(self, title: str, content: Any) -> str:
        if isinstance(content, dict):
            parts = []
            for key, val in content.items():
                if isinstance(val, list):
                    parts.append(f"  {key.replace('_', ' ').title()}: {', '.join(str(v) for v in val[:5])}")
                elif isinstance(val, dict):
                    parts.append(f"  {key.replace('_', ' ').title()}: {', '.join(f'{k}: {v}' for k, v in list(val.items())[:3])}")
                else:
                    parts.append(f"  {key.replace('_', ' ').title()}: {val}")
            return '\n'.join(parts)
        elif isinstance(content, list):
            return ', '.join(str(item) for item in content)
        else:
            return str(content)

    def _extract_key_points(self, knowledge: Dict) -> List[str]:
        details = knowledge.get('details', {})
        points = []
        for key in list(details.keys())[:5]:
            value = details[key]
            if isinstance(value, list) and value:
                points.append(f"{key.replace('_', ' ').title()}: {value[0]}")
            elif isinstance(value, str):
                points.append(f"{key.replace('_', ' ').title()}: {value[:100]}")
        return points

    def _create_visual_prompt(self, knowledge: Dict, topic: str) -> str:
        prompts = {
            'pathogen': f"Scientific illustration of {topic} showing cellular structure and infection mechanism",
            'virus': f"Medical illustration of {topic} virus particle showing envelope, spikes, and genetic material",
            'bacteria': f"Electron microscopy illustration of {topic} bacterium with cell wall and flagella",
            'covid-19': "SARS-CoV-2 virus particle with spike proteins, RNA core, and lipid envelope",
            'dna': "DNA double helix structure showing base pairs and molecular bonds",
            'cell': "Eukaryotic cell diagram showing nucleus, organelles, and cellular structures",
            'heart': "Human heart anatomy showing chambers, valves, and blood flow",
            'brain': "Brain anatomy showing regions and their functions",
            'lung': "Respiratory system with lungs, trachea, bronchi, and alveoli",
            'cancer': "Cancer cell biology showing mutations and hallmarks",
            'immune_system': "Immune system components showing innate and adaptive immunity",
            'muscle': "Muscle tissue types showing skeletal, cardiac, and smooth",
            'nervous_system': "Nervous system structure showing CNS and PNS",
        }
        return prompts.get(topic.lower(),
                          f"Scientific illustration of {topic} showing structure, function, and key components")

    def get_available_topics(self) -> Dict:
        return {
            'visual_topics': self.knowledge_base.visual_topics,
            'all_topics': list(self.knowledge_base.knowledge.keys()),
            'count': len(self.knowledge_base.knowledge)
        }
