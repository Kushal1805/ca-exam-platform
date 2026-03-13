import fitz

def parse_pdf():
    try:
        doc = fitz.open('Accounting.pdf')
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        with open('Accounting.txt', 'w', encoding='utf-8') as out:
            out.write(text)
        print("Success")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parse_pdf()
