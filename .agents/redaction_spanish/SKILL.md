# SKILL - Redacción de Markdown en Español (Latinoamericano - Panamá)

## Propósito
Esta skill define las **reglas obligatorias** para cualquier agente IA que redacte o corrija documentos Markdown en español para el anteproyecto de Justin Barrios (y documentos académicos de la UTP en general).

---

## 1. Reglas Ortográficas y Gramaticales (Obligatorias)

### Acentos (Tildes)
- **Siempre usar tildes correctamente** según las reglas del español:
  - Palabras agudas terminadas en vocal, **n** o **s** (café, está, Panamá, kilovatio)
  - Palabras graves/llanas con tilde cuando corresponde (árbol, fácil, último)
  - Palabras esdrújulas **siempre** con tilde (práctica, energía, análisis)
  - Verbos (está, realizó, implementará, configuró, etc.)
- **Prohibido**: omitir tildes por comodidad (no escribir "esta", "solo", "mas" cuando corresponde tilde)

### Letra Ñ
- **Siempre usar ñ y Ñ** correctamente:
  - Año, señor, España, compañía, gestión, desempeño, etc.
  - Nunca reemplazar por "n" o "gn".

### Signos de Interrogación y Exclamación
- **Siempre abrir y cerrar**:
  - ¿Cómo se configura el tenant?
  - ¡Atención!
  - ¿Qué dispositivos se integrarán?

### Mayúsculas
- Mayúscula después de punto y seguido.
- Mayúscula en nombres propios: Kilowattia, Layrz, ThingsBoard, Panamá, Universidad Tecnológica de Panamá, ESCO, etc.
- Títulos y subtítulos: Primera letra en mayúscula y el resto según corresponda (estilo título).

### Vocabulario Panameño / Latinoamericano
- Preferir términos neutros de América Latina.
- Evitar español de España (utilizar "computadora", "celular", "fácil de usar", etc.).
- Términos técnicos aceptados:
  - **Dashboard** (aceptado), también se puede usar **tablero** o **panel de control**.
  - **Frontend**, **Backend**, **Tenant**, **Telemetría**, **Multitenant**, **White Label**.

---

## 2. Estilo de Redacción Académica

- **Tono**: Formal, objetivo y técnico.
- **Persona**: Preferiblemente **tercera persona** ("Se desarrollará...", "El estudiante implementará...", "La plataforma permitirá...").
- **Claridad**: Oraciones concisas y precisas. Evitar repeticiones innecesarias.
- **Género**: Usar lenguaje inclusivo cuando corresponda, pero sin forzar (ej: "los usuarios y las usuarias" → mejor "los usuarios").
- **Evitar**:
  - Contracciones (no usar "no se" → escribir completo cuando sea posible).
  - Anglicismos innecesarios cuando existe equivalente en español.
  - Expresiones coloquiales.

---

## 3. Buenas Prácticas de Markdown

- Usar jerarquía correcta de encabezados: `#` (título), `##` (sección), `###` (subsección).
- Tablas bien formateadas y alineadas.
- Listas con `-` o números.
- **Negritas** (`**texto**`) solo para resaltar conceptos clave.
- *Cursiva* para términos extranjeros la primera vez o énfasis suave.
- Código inline con `` ` `` y bloques de código con triple backtick + lenguaje (`python`, `json`, etc.).
- Enlaces: `[texto](url)`.

### Ejemplo de tabla recomendada:
```markdown
| Rol                        | Función                          |
|---------------------------|----------------------------------|
| Administrador Kilowattia  | Control global de la plataforma |