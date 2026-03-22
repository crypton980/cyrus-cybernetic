import PyPDF2
import docx
import os
import json

files = [
    '/Users/cronet/Downloads/balopi Demand letter.docx',
    '/Users/cronet/Downloads/Data Protection Act.pdf',
    '/Users/cronet/Downloads/Financial Intelligence Act 2022.pdf',
    '/Users/cronet/Downloads/High Court Rules.pdf',
    '/Users/cronet/Downloads/Mag Court Rules.pdf',
    '/Users/cronet/Downloads/Micro Lending Regulations 2012.pdf',
    '/Users/cronet/Downloads/Prescriptions Act.pdf'
]

legal_texts = {}

for file_path in files:
    try:
        if file_path.endswith('.pdf'):
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ''
                for page in reader.pages:
                    text += page.extract_text() + '\n'
        elif file_path.endswith('.docx'):
            doc = docx.Document(file_path)
            text = '\n'.join([para.text for para in doc.paragraphs])
        else:
            continue
        
        name = os.path.basename(file_path).replace('.pdf', '').replace('.docx', '')
        legal_texts[name] = text[:10000]  # Limit to 10000 chars
        print(f"Extracted {len(text)} chars from {name}")
    except Exception as e:
        print(f"Error extracting {file_path}: {e}")

with open('legal_documents.json', 'w') as f:
    json.dump(legal_texts, f, indent=2)

print("Legal documents extracted and saved to legal_documents.json")