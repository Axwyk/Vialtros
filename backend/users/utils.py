import re


def normalize_name(value):
    """
    Normaliza un nombre de persona a Title Case.
    - Elimina espacios al inicio/final y espacios duplicados.
    - Convierte la primera letra de cada palabra a mayúscula y el resto a minúscula.
    - Compatible con caracteres Unicode (tildes, ñ, etc.).

    Ejemplo: '  jUaN   caRlOs  péReZ  ' -> 'Juan Carlos Pérez'
    """
    if not value:
        return ""
    cleaned = re.sub(r'\s+', ' ', str(value).strip())
    return " ".join(word.capitalize() for word in cleaned.split())
