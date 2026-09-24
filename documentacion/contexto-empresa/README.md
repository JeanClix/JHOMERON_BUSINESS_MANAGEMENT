# Contexto de empresa — corpus semilla para RAG

Documentos markdown con información pública de Industrias Jhomeron S.A., extraída de `https://www.jhomeron.com` el 2026-09-22. Pensado como el corpus inicial para el módulo de RAG del chat de contexto (ver `sistema_jhomeron.md` §3 y `README.md` raíz — RAG sobre documentación empresarial, fase futura, hoy la página `/gerencia/documentacion` es 100% mock).

- `00-empresa.md` — historia, misión, visión, valores, posicionamiento.
- `01-lineas-producto.md` — catálogo público de las 8 líneas de producto.
- `02-puntos-venta-contacto.md` — direcciones, teléfonos, horarios, cobertura.
- `03-terminos-condiciones.md` — resumen de términos de venta.

## Lo que falta (no está en la web pública)

Esta es información de **marketing/institucional**, útil para dar contexto general y atención de primer nivel. **No cubre** lo que se pidió como caso de uso principal — ayuda a empleados nuevos con el paso a paso de procesos internos (ej. cómo registrar una venta, protocolo de control de calidad real, política de créditos real, proceso de onboarding) — porque eso no está publicado en ningún lado accesible por scraping. Esos documentos los tienen que redactar/subir Admin o Gerencia directamente.

## Siguiente paso técnico

Cuando se implemente el pipeline de ingesta (chunking + embeddings + pgvector, ver decisión discutida en memoria de proyecto), estos archivos son el primer batch a indexar. La función de "Admin/Gerencia puede editar o subir más documentos" implica además un endpoint de carga (CRUD sobre estos documentos + re-indexado), que todavía no existe — hoy son archivos planos en el repo.
