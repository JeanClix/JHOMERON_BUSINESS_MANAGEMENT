JHOMERON — Arquitectura de Inteligencia y MLOps

1. Objetivo general

​

JHOMERON será una plataforma de gestión empresarial que integrará dos capacidades de inteligencia diferentes:

​

Machine Learning predictivo

​

Orientado a problemas cuantitativos del negocio:

​

Predicción de ventas.

Forecasting de demanda.

Detección de comportamientos anómalos.

Predicción de indicadores.

Análisis de tendencias.

IA generativa

​

Orientada a interacción y análisis:

​

Asistente de gerencia.

Preguntas sobre ventas.

Explicación de indicadores.

Consulta de documentación empresarial.

Generación de análisis en lenguaje natural.

​

La separación es importante:

​

ML predice; el LLM interpreta, consulta y explica.

2. Arquitectura general

                              ┌─────────────────────┐

                              │       USUARIO       │

                              └──────────┬──────────┘

                                         │

                                         ▼

                              ┌─────────────────────┐

                              │       ANGULAR       │

                              │      Frontend       │

                              └──────────┬──────────┘

                                         │

                                         ▼

                              ┌─────────────────────┐

                              │     SPRING BOOT     │

                              │    Backend API      │

                              └──────────┬──────────┘

                                         │

              ┌──────────────────────────┼──────────────────────────┐

              │                          │                          │

              ▼                          ▼                          ▼

       ┌─────────────┐            ┌─────────────┐            ┌─────────────┐

       │  DATABASE   │            │ ML SERVICE  │            │ AI SERVICE  │

       │ PostgreSQL  │            │             │            │             │

       └──────┬──────┘            └──────┬──────┘            └──────┬──────┘

              ▲                          │                          │

              │                          ▼                          ▼

       ┌──────┴──────┐             ┌──────────┐              ┌──────────┐

       │    BATCH    │             │ XGBoost  │              │   LLM    │

       │     ETL     │             │ / ML     │              └────┬─────┘

       └──────▲──────┘             └────┬─────┘                   │

              │                         │                    ┌────┴────┐

              │                         ▼                    │         │

          SAP / ERP                  MLflow               Ollama    vLLM

JHOMERON — Arquitectura de Inteligencia y MLOps

    Objetivo general

JHOMERON será una plataforma de gestión empresarial que integrará dos capacidades de inteligencia diferentes:

Machine Learning predictivo

Orientado a problemas cuantitativos del negocio:

Predicción de ventas.
Forecasting de demanda.
Detección de comportamientos anómalos.
Predicción de indicadores.
Análisis de tendencias.
IA generativa

Orientada a interacción y análisis:

Asistente de gerencia.
Preguntas sobre ventas.
Explicación de indicadores.
Consulta de documentación empresarial.
Generación de análisis en lenguaje natural.

La separación es importante:

ML predice; el LLM interpreta, consulta y explica.

    Arquitectura general

                               ┌─────────────────────┐
                               │       USUARIO       │
                               └──────────┬──────────┘
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │       ANGULAR       │
                               │      Frontend       │
                               └──────────┬──────────┘
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │     SPRING BOOT     │
                               │    Backend API      │
                               └──────────┬──────────┘
                                          │
               ┌──────────────────────────┼──────────────────────────┐
               │                          │                          │
               ▼                          ▼                          ▼
        ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
        │  DATABASE   │            │ ML SERVICE  │            │ AI SERVICE  │
        │ PostgreSQL  │            │             │            │             │
        └──────┬──────┘            └──────┬──────┘            └──────┬──────┘
               ▲                          │                          │
               │                          ▼                          ▼
        ┌──────┴──────┐             ┌──────────┐              ┌──────────┐
        │    BATCH    │             │ XGBoost  │              │   LLM    │
        │     ETL     │             │ / ML     │              └────┬─────┘
        └──────▲──────┘             └────┬─────┘                   │
               │                         │                    ┌────┴────┐
               │                         ▼                    │         │
           SAP / ERP                  MLflow               Ollama    vLLM
                                         │                  LOCAL      PROD
                                         │
                          ┌──────────────┴──────────────┐
                          │                             │
                       Prefect                      Evidently
                          │                             │
                     Pipelines                    Data Drift
                                                        │
                                                        ▼
                                                     Grafana

    Estructura del proyecto

La estructura propuesta sería:
JHOMERON_BUSINESS_MANAGEMENT/
│
├── frontend/
│ └── Angular
│
├── backend/
│ │
│ ├── api/
│ │ └── Spring Boot
│ │
│ └── batch/
│ └── ETL / procesamiento
│
├── intelligence/
│ │
│ ├── ml/
│ │ ├── data/
│ │ ├── notebooks/
│ │ ├── src/
│ │ │ ├── preprocessing/
│ │ │ ├── features/
│ │ │ ├── training/
│ │ │ ├── evaluation/
│ │ │ └── inference/
│ │ ├── models/
│ │ └── experiments/
│ │
│ └── ai/
│ ├── src/
│ ├── prompts/
│ ├── rag/
│ ├── tools/
│ └── evaluation/
│
├── infrastructure/
│ ├── docker/
│ ├── mlflow/
│ ├── prefect/
│ ├── grafana/
│ └── docker-compose.yml
│
├── data/
│ ├── input/
│ └── output/
│
├── docs/
│ ├── architecture/
│ ├── ml/
│ ├── ai/
│ └── api/
│
└── README.md

    Flujo completo de datos

Este es uno de los diagramas que sí o sí debería estar en tu documentación.
FUENTES DE DATOS
│
┌─────────────┴─────────────┐
│ │
▼ ▼
SAP Otras fuentes
│
▼
┌──────────────┐
│ BATCH │
│ Java / ETL │
└──────┬───────┘
│
▼
┌──────────────┐
│ DATABASE │
│ PostgreSQL │
└──────┬───────┘
│
┌─────┴─────┐
│ │
▼ ▼
Backend ML
│ │
│ ▼
│ Preprocessing
│ │
│ ▼
│ Feature Engineering
│ │
│ ▼
│ Training
│ │
│ ▼
│ MLflow
│ │
│ ▼
│ Modelo
│ │
│ ▼
│ Predicciones
│ │
└─────┬─────┘
▼
Angular
│
▼
Dashboard Gerencia

    Etapa 1 — Ingesta de datos

El primer problema no es Machine Learning.

Es conseguir datos confiables.

Por ejemplo:
SAP
│
├── Ventas
├── Productos
├── Clientes
├── Inventario
└── Fechas
│
▼
BATCH
│
▼
Transformación
│
▼
PostgreSQL
El módulo batch será responsable de:

Extraer.
Limpiar.
Transformar.
Validar.
Cargar.

Esto es importante porque el modelo será tan bueno como los datos que recibe.

    Etapa 2 — Machine Learning

Aquí comienza realmente el proyecto ML.

Primero se analiza:
Ventas históricas
│
▼
Exploración
│
▼
Variables relevantes
│
▼
Feature Engineering
│
▼
Dataset ML
Ejemplo:
fecha
producto
categoria
cantidad
precio
descuento
cliente
vendedor
dia_semana
mes
temporada
ventas_ultimos_7_dias
ventas_ultimos_30_dias
Estas variables pueden utilizarse para construir el modelo.

    Entrenamiento

No debemos asumir desde el principio que XGBoost será el mejor.

Se pueden comparar varios modelos:
DATASET
│
┌───────────┼───────────┐
▼ ▼ ▼
Regression Random Forest XGBoost
│ │ │
▼ ▼ ▼
MAE MAE MAE
│ │ │
└───────────┼───────────┘
▼
Mejor modelo
│
▼
MLflow
Esto es mucho más correcto que decir:

“Vamos a usar XGBoost porque sí.”

Primero se evalúa.

    MLflow

MLflow será el sistema de trazabilidad del modelo.

Por ejemplo:
Experiment: sales_forecasting

Run 001
Model: Random Forest
MAE: 1500

Run 002
Model: XGBoost
MAE: 980

Run 003
Model: XGBoost
MAE: 850
Entonces podemos saber:

Qué modelo se entrenó.
Con qué datos.
Con qué parámetros.
Qué métricas obtuvo.
Qué versión está en producción.

    Versionamiento del modelo

La evolución podría ser:
Modelo v1
│
├── Accuracy / MAE
├── Dataset
└── Parámetros
│
▼
Producción
Después llegan nuevos datos:
Nuevos datos
│
▼
Reentrenamiento
│
▼
Modelo v2
│
▼
Evaluación
│
▼
¿Mejor que v1?
Si no mejora:
v2 ❌
↓
mantener v1
Si mejora:

v2 ✅
↓
producción

    Prefect

Prefect automatizará este proceso.

En lugar de ejecutar manualmente:
python preprocess.py
python train.py
python evaluate.py
tendríamos:
PREFECT
│
▼
Obtener datos
│
▼
Preprocesar
│
▼
Feature Engineering
│
▼
Entrenar
│
▼
Evaluar
│
▼
MLflow
│
▼
Registrar nuevo modelo
Esto convierte el entrenamiento en un pipeline reproducible.

    Servicio de Machine Learning

Una vez entrenado el modelo necesitamos consumirlo desde JHOMERON.

Por ejemplo:
Spring Boot
│
│ POST /prediction
▼
ML Service
│
▼
Modelo
│
▼
Predicción
Respuesta:

{
“period”: “2026-09”,
“predictedSales”: 58400.50,
“modelVersion”: “v3”
}

FastAPI es una opción, pero no debemos asumir todavía que será obligatoria. Dependiendo del diseño final podemos utilizar FastAPI, MLflow Model Serving u otro mecanismo.

    Integración con Spring Boot

Spring Boot sigue siendo el backend empresarial principal.

No deberíamos trasladar toda la lógica de negocio a Python.
Angular
↓
Spring Boot
│
├── Clientes
├── Ventas
├── Productos
├── Usuarios
├── Dashboard
│
└── ML
↓
ML Service
Esto mantiene una separación clara.

    Dashboard de Gerencia

Angular mostrará los resultados.

Ejemplo:
┌──────────────────────────────────────────────┐
│ DASHBOARD GERENCIA │
├──────────────────────────────────────────────┤
│ │
│ Ventas actuales S/ 125,430 │
│ │
│ Predicción próximo mes │
│ │
│ S/ 138,700 │
│ │
├──────────────────────────────────────────────┤
│ │
│ Ventas históricas + Forecast │
│ │
│ ────────────────╮ │
│ ╰───────────────╮ │
│ ╰────── │
│ │
├──────────────────────────────────────────────┤
│ 🤖 Asistente de Gerencia │
│ │
│ “¿Por qué se espera este crecimiento?” │
└──────────────────────────────────────────────┘

    IA generativa

Aquí comienza el segundo sistema de inteligencia.

No debemos confundirlo con el modelo predictivo.
MACHINE LEARNING
│
▼
Predicción numérica

             GENERATIVE AI
                    │
                    ▼
             Explicación
             Conversación
             Análisis

    Ollama en desarrollo

Durante desarrollo:
Spring Boot
│
▼
AI Service
│
▼
Ollama
│
▼
Modelo LLM
Esto permite trabajar localmente sin depender necesariamente de una API externa.

    vLLM en producción

En producción:
Spring Boot
│
▼
AI Service
│
▼
vLLM
│
▼
LLM
La aplicación no debería saber si detrás está Ollama o vLLM.

Idealmente:

                 AI SERVICE
                     │
             OpenAI-compatible API
                     │
              ┌──────┴──────┐
              ▼             ▼
           Ollama          vLLM
           LOCAL            PROD

Esto permite cambiar el motor de inferencia sin rediseñar todo el backend.

    RAG

Para el asistente de gerencia, podríamos incorporar RAG.

Pero no empezaría por RAG.

Primero debemos conseguir que el asistente pueda consultar datos reales.

Por ejemplo:
Usuario
│
▼
“¿Cuánto vendimos este mes?”
│
▼
LLM
│
▼
Tool
│
▼
Spring Boot
│
▼
Database
│
▼
Resultado
│
▼
LLM
│
▼
Respuesta
Después podemos añadir documentación empresarial:

Documentación
↓
Embeddings
↓
Vector Store
↓
RAG
↓
LLM

    Diferencia entre ML y LLM

Esta parte debería quedar explícita en la documentación.

Necesidad Tecnología
Predecir ventas ML
Forecasting ML
Clasificar clientes ML
Detectar anomalías ML
Explicar resultados LLM
Preguntar sobre el negocio LLM
Consultar documentación RAG + LLM
Generar análisis LLM

Por eso:

No utilizaremos un LLM para reemplazar innecesariamente los modelos predictivos tradicionales.

    Monitoreo

Una vez desplegado el modelo:

              MODELO EN PRODUCCIÓN
                       │
                       ▼
                  Predicciones
                       │
                       ▼
                   Monitoring
                       │
              ┌────────┴────────┐
              ▼                 ▼
          Performance        Data Drift
                                  │
                                  ▼
                              Evidently
                                  │
                                  ▼
                               Grafana

    Data Drift

Supongamos que el modelo fue entrenado con:

Ventas 2025-2026

Pero el comportamiento del negocio cambia:

2027
↓
Nuevos productos
Nuevos clientes
Nuevos precios
Nuevas temporadas

La distribución de los datos puede cambiar.

Entonces:

Datos entrenamiento
≠
Datos producción

Esto puede provocar pérdida de rendimiento.

Evidently puede ayudarnos a detectar estos cambios.

    Reentrenamiento

Cuando detectemos un problema:

Data Drift
│
▼
Evidently
│
▼
Trigger
│
▼
Prefect
│
▼
Nuevo dataset
│
▼
Entrenamiento
│
▼
MLflow
│
▼
Nuevo modelo

Pero no recomiendo que el modelo se reemplace automáticamente sin validación.

Debe existir una condición:

Nuevo modelo
│
▼
Evaluación
│
▼
¿Mejora?
│ │
NO SÍ
│ │
▼ ▼
Mantener Deploy
modelo
actual

    Docker

Cada componente podrá empaquetarse independientemente:

Docker
│
├── Spring Boot
├── ML Service
├── AI Service
├── MLflow
├── Prefect
└── Grafana

Para desarrollo:

docker-compose.yml

permitirá levantar la infraestructura necesaria.

    Producción

La arquitectura final podría evolucionar hacia:

                        INTERNET
                           │
                           ▼
                       FRONTEND
                        Angular
                           │
                           ▼
                     Spring Boot
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
       Database         ML Service       AI Service
                            │                 │
                            ▼                 ▼
                         Model              vLLM
                            │                 │
                         MLflow              LLM
                            │
                         Prefect
                            │
                         Evidently
                            │
                         Grafana

Todo empaquetado y desplegado mediante Docker/AWS según las necesidades reales del proyecto.

    Orden real de desarrollo

Esta sería mi recomendación crítica para no sobrecomplicar el proyecto:

FASE 1
JHOMERON base
↓
Angular + Spring Boot + DB

FASE 2
Integración de datos
↓
Batch + SAP + DB

FASE 3
Machine Learning
↓
Python + Pandas + Scikit-learn
↓
XGBoost / otros modelos
↓
Predicción

FASE 4
MLOps
↓
MLflow
↓
Prefect
↓
Docker
↓
Evidently

FASE 5
Integración ML
↓
Spring Boot
↓
ML Service
↓
Angular

FASE 6
Generative AI
↓
AI Service
↓
Ollama
↓
Tools
↓
RAG

FASE 7
Producción
↓
vLLM
↓
AWS
↓
Monitoring

    Stack tecnológico propuesto
    Capa Tecnología
    Frontend Angular
    Backend Java + Spring Boot
    ETL/Batch Java / Spring Batch
    Base de datos PostgreSQL
    ML Python
    ML Framework Scikit-learn / XGBoost
    Tracking MLflow
    Orquestación Prefect
    ML API FastAPI o MLflow Serving
    LLM local Ollama
    LLM producción vLLM
    RAG Por definir
    Contenedores Docker
    Cloud AWS
    Monitoring ML Evidently
    Dashboards Grafana
    La idea central de JHOMERON

La arquitectura completa puede resumirse en cuatro niveles:

                 JHOMERON
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      DATOS        ML           GENAI
        │            │            │
        ▼            ▼            ▼
      Batch       XGBoost        LLM
        │            │            │
        ▼          MLflow       Ollama
    PostgreSQL     Prefect        │
                     │           vLLM
                  Evidently
                     │
                  Grafana

Y la filosofía sería:

Los datos alimentan el sistema.

Machine Learning transforma esos datos en predicciones.

MLOps garantiza que los modelos puedan entrenarse, versionarse, desplegarse y monitorearse.

La IA generativa permite que los usuarios interactúen con la información y comprendan los resultados.

Spring Boot funciona como núcleo de la aplicación empresarial y Angular como interfaz.

