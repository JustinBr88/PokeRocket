# Issues Pendientes - Pokefighter

## Estado: Issues Reportados

---

## 1. Sistema de Música/Sonido No Funciona

**Descripción:** La música por pantalla y los sonidos de ataques no se escuchan aunque la Fase 5 fue implementada.

**Archivos relacionados:**
- `frontend/src/lib/musicManager.ts`
- `frontend/src/lib/movesetSounds.ts`
- `frontend/src/stores/musicStore.ts`
- `frontend/src/components/MusicProvider.tsx`
- `frontend/src/app/routes/battle.tsx`

**Verificar:**
1. Que los archivos de audio estén en la carpeta `public/sonidos/` o sean accesibles
2. Que el `MusicProvider` esté correctamente envuelto en `main.tsx`
3. Que los paths de audio sean correctos (relativos al index.html)
4. Que el navegador no esté bloqueando el autoplay

---

## 2. Error 500 en Confirm Team - teams.tsx

**Descripción:** Al hacer click en "Confirm Team" en `/teams/:roomId`, retorna error 500 del endpoint.

**Endpoint fallando:**
```
POST http://localhost:3001/api/rooms/UAOC7T/team-ready
500 (Internal Server Error)
```

**Error en consola:**
```
teams.tsx:157 POST http://localhost:3001/api/rooms/UAOC7T/team-ready 500 (Internal Server Error)
teams.tsx:169 [Teams] Failed to save team: SyntaxError: Unexpected token 'I', "Internal S"... is not valid JSON
```

**Posibles causas:**
1. El backend no tiene implementado el endpoint `/api/rooms/:roomId/team-ready`
2. El endpoint existe pero tiene un error de lógica
3. El body de la request está malformado

**Archivos a revisar:**
- `backend/src/routes/rooms.ts` - Verificar que existe `POST /rooms/:roomId/team-ready`
- `frontend/src/app/routes/teams.tsx:157` - Verificar el payload enviado

---

## Nota

Estos issues impiden probar correctamente las funcionalidades de:
- Team Builder (confirmación de equipo)
- Batalla (sonidos de ataques)
- Experiencia general (música de fondo)

**Prioridad:** Alta - Bloquean testing básico del flujo de juego.
