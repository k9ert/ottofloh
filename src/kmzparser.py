from pykml import parser
from zipfile import ZipFile

extracted=False
kml_file_path = ""  # Update this path
def init():
    global extracted
    global kml_file_path
    if not extracted:
        kml_file_path = extract_kml_from_kmz('data.kmz')
        print("Extracting KML from KMZ file: "+kml_file_path)
        extracted=True

def extract_kml_from_kmz(kmz_file_path):
    with ZipFile(kmz_file_path, 'r') as kmz:
        kmz.extractall('build/kmz_content')
        for filename in kmz.namelist():
            if filename.endswith('.kml'):
                return f'build/kmz_content/{filename}'
    return None

def parse_kml_coordinates():
    with open(kml_file_path, 'rb') as kml_file:
        doc = parser.parse(kml_file).getroot()
        # Implement namespace handling if needed
        coordinates_with_styles = []
        print("yeah")
        print(str(doc.Document.name.text))
        print(str(doc.Document.Placemark.name.text))
        print("iterating ...")
        for placemark in doc.Document.Placemark:
            name = placemark.name.text
            coord = placemark.Point.coordinates.text.strip().split(',')
            styleUrl = placemark.styleUrl.text  # Extract the styleUrl.
            coordinates_with_styles.append((coord[1], coord[0], styleUrl))  # lat, lon, styleUrl
    return coordinates_with_styles

def parse_kml_addresses():
    with open(kml_file_path, 'rb') as kml_file:
        doc = parser.parse(kml_file).getroot()
        # Implement namespace handling if needed
        addresses = []
        print("yeah")
        print(str(doc.Document.name.text))
        print(str(doc.Document.Placemark.name.text))
        print("iterating ...")
        for placemark in doc.Document.Placemark:
            name = placemark.name.text
            # Extract coordinates and any other necessary details
            coord = placemark.Point.coordinates.text.strip().split(',')
            addresses.append(name)
        return addresses
    
init()
print(extracted)