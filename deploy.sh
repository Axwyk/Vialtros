#!/bin/bash
#
# Deploy script for Vialtros
# Uso: bash deploy.sh [dev|production]
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funciones auxiliares
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Obtener parámetro de ambiente
ENVIRONMENT=${1:-development}

if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Ambiente debe ser 'development' o 'production'"
    exit 1
fi

log_info "Iniciando despliegue en ambiente: $ENVIRONMENT"

# Verificar que estamos en el directorio correcto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Debe ejecutarse desde la raíz del proyecto (donde están backend/ y frontend/)"
    exit 1
fi

# Backend
log_info "Actualizando Backend..."
cd backend

# Crear virtual environment si no existe
if [ ! -d "venv" ]; then
    log_info "Creando virtual environment..."
    python3.11 -m venv venv
fi

# Activar virtual environment
source venv/bin/activate

# Instalar dependencias
log_info "Instalando dependencias de Python..."
pip install --upgrade pip
pip install -r requirements.txt

# Ejecutar migraciones
log_info "Ejecutando migraciones de BD..."
python manage.py migrate

# Crear usuario admin si no existe
log_info "Asegurando que usuario admin existe..."
python manage.py create_admin || log_warn "Usuario admin ya existe o no se pudo crear"

# Recolectar archivos estáticos
if [[ "$ENVIRONMENT" == "production" ]]; then
    log_info "Recolectando archivos estáticos para producción..."
    python manage.py collectstatic --noinput
else
    log_warn "En desarrollo, omitiendo collectstatic"
fi

cd ..

# Frontend
log_info "Actualizando Frontend..."
cd frontend

# Instalar dependencias
log_info "Instalando dependencias de Node..."
npm ci

# Verificar que existe .env con las variables necesarias
if [ ! -f ".env" ]; then
    log_warn "No se encontró frontend/.env — copiando desde .env.example"
    cp .env.example .env
    log_error "IMPORTANTE: Edita frontend/.env con los valores reales antes de hacer deploy:"
    log_error "  REACT_APP_API_URL=https://vialtros.ds1.eleueleo.com/api"
    log_error "  REACT_APP_WS_URL=wss://vialtros.ds1.eleueleo.com/ws"
    log_error "  REACT_APP_GOOGLE_MAPS_API_KEY=tu_key_aqui"
    log_error "Luego vuelve a ejecutar: bash deploy.sh production"
    exit 1
fi

if ! grep -q "REACT_APP_GOOGLE_MAPS_API_KEY=." .env; then
    log_error "REACT_APP_GOOGLE_MAPS_API_KEY está vacía en frontend/.env"
    log_error "Agrégala antes de continuar."
    exit 1
fi

# Build
log_info "Construyendo aplicación React..."
npm run build

cd ..

log_info "═════════════════════════════════════════════════════════"
log_info "✓ Despliegue completado exitosamente en $ENVIRONMENT"
log_info "═════════════════════════════════════════════════════════"

if [[ "$ENVIRONMENT" == "production" ]]; then
    log_info "Siguientes pasos:"
    log_info "1. Reinicia los servicios:"
    log_info "   sudo systemctl restart vialtros-django"
    log_info "   sudo systemctl restart apache2"
    log_info ""
    log_info "2. Verifica que todo funciona:"
    log_info "   curl http://vialtros.ds1.eleueleo.com"
    log_info ""
    log_info "3. Inicia sesión con:"
    log_info "   Usuario: admin"
    log_info "   Contraseña: admin123"
fi
