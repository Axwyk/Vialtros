#!/bin/bash
#
# Quick Setup Script for Vialtros Deployment
# Configura todo lo necesario para desplegar en Apache
# Uso: bash quick-setup.sh
#

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   VIALTROS - Quick Setup para Apache Server   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Verificar sistemas
echo -e "${YELLOW}[1] Verificando dependencias del sistema...${NC}"

command -v python3.11 >/dev/null 2>&1 || {
    echo -e "${RED}✗ Python 3.11 no está instalado${NC}"
    echo "  Instala con: sudo apt install python3.11 python3.11-venv python3.11-dev"
    exit 1
}
echo -e "${GREEN}✓ Python $(python3.11 --version)${NC}"

command -v node >/dev/null 2>&1 || {
    echo -e "${RED}✗ Node.js no está instalado${NC}"
    echo "  Instala con: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install nodejs"
    exit 1
}
echo -e "${GREEN}✓ Node $(node --version)${NC}"

command -v npm >/dev/null 2>&1 || {
    echo -e "${RED}✗ npm no está instalado${NC}"
    exit 1
}
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

command -v apache2 >/dev/null 2>&1 || {
    echo -e "${RED}✗ Apache no está instalado${NC}"
    echo "  Instala con: sudo apt install apache2 libapache2-mod-proxy-http"
    exit 1
}
echo -e "${GREEN}✓ Apache instalado${NC}"

command -v git >/dev/null 2>&1 || {
    echo -e "${RED}✗ Git no está instalado${NC}"
    exit 1
}
echo -e "${GREEN}✓ Git instalado${NC}"

echo ""

# 2. Crear estructura de directorios
echo -e "${YELLOW}[2] Creando estructura de directorios...${NC}"

mkdir -p ~/vialtros-backups
echo -e "${GREEN}✓ Directorio de backups creado${NC}"

echo ""

# 3. Configurar variables de entorno
echo -e "${YELLOW}[3] Configurando variables de entorno...${NC}"

read -p "¿Ya tienes el archivo .env configurado en backend/? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}   Generando archivo .env de ejemplo...${NC}"
    
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << 'EOF'
# ===== CONFIGURACIÓN DE DJANGO (PRODUCCIÓN) =====
DJANGO_SECRET_KEY=t40z8_wl3zb_9f3xd7zdf+yk2@zk%e-&t_=j#86h4xh83=6d$
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vialtros.ds1.eleueleo.com,www.vialtros.ds1.eleueleo.com,127.0.0.1,localhost

# ===== CONFIGURACIÓN DE BASE DE DATOS (NEON) =====
DB_ENGINE=django.db.backends.postgresql
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=npg_xD5aF7juWrHc
DB_HOST=ep-lucky-poetry-ap6otfso-pooler.c-7.us-east-1.aws.neon.tech
DB_PORT=5432

# ===== CORS PARA PRODUCCIÓN =====
CORS_ALLOWED_ORIGINS=https://www.vialtros.ds1.eleueleo.com,https://vialtros.ds1.eleueleo.com

# ===== EMAIL (OPCIONAL) =====
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EOF
        echo -e "${GREEN}✓ Archivo .env creado (revísalo y ajusta valores)${NC}"
        echo -e "${YELLOW}   Ubicación: backend/.env${NC}"
    fi
fi

echo ""

# 4. Instalar dependencias backend
echo -e "${YELLOW}[4] Instalando dependencias backend...${NC}"

cd backend

if [ ! -d "venv" ]; then
    python3.11 -m venv venv
    echo -e "${GREEN}✓ Virtual environment creado${NC}"
fi

source venv/bin/activate

pip install --upgrade pip >/dev/null 2>&1
pip install -r requirements.txt

echo -e "${GREEN}✓ Dependencias backend instaladas${NC}"

# 5. Ejecutar migraciones
echo -e "${YELLOW}[5] Ejecutando migraciones de BD...${NC}"

python manage.py migrate

echo -e "${GREEN}✓ Migraciones completadas${NC}"

# 6. Crear usuario admin
echo -e "${YELLOW}[6] Creando usuario administrador de prueba...${NC}"

python manage.py create_admin

echo -e "${GREEN}✓ Usuario admin creado (admin / admin123)${NC}"

# 7. Recolectar estáticos
echo -e "${YELLOW}[7] Recolectando archivos estáticos...${NC}"

python manage.py collectstatic --noinput >/dev/null 2>&1

echo -e "${GREEN}✓ Archivos estáticos recolectados${NC}"

# 8. Instalar Gunicorn
echo -e "${YELLOW}[8] Instalando Gunicorn...${NC}"

pip install gunicorn >/dev/null 2>&1

echo -e "${GREEN}✓ Gunicorn instalado${NC}"

# 9. Crear config de Gunicorn
echo -e "${YELLOW}[9] Creando configuración de Gunicorn...${NC}"

cat > gunicorn_config.py << 'EOF'
import multiprocessing

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
EOF

echo -e "${GREEN}✓ Configuración de Gunicorn creada${NC}"

cd ..

# 10. Instalar dependencias frontend
echo -e "${YELLOW}[10] Instalando dependencias frontend...${NC}"

cd frontend

npm ci >/dev/null 2>&1

echo -e "${GREEN}✓ Dependencias frontend instaladas${NC}"

# 11. Compilar frontend
echo -e "${YELLOW}[11] Compilando frontend...${NC}"

npm run build >/dev/null 2>&1

echo -e "${GREEN}✓ Frontend compilado${NC}"

cd ..

# 12. Instrucciones finales
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ✓ Setup Completado Exitosamente       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}PRÓXIMOS PASOS (ejecutar como sudo o root):${NC}"
echo ""

echo "1. Habilitar módulos de Apache:"
echo -e "   ${GREEN}sudo a2enmod proxy${NC}"
echo -e "   ${GREEN}sudo a2enmod proxy_http${NC}"
echo -e "   ${GREEN}sudo a2enmod rewrite${NC}"
echo ""

echo "2. Crear systemd service para Django:"
echo -e "   ${GREEN}sudo cp etc/systemd/vialtros-django.service /etc/systemd/system/${NC}"
echo -e "   ${GREEN}sudo systemctl daemon-reload${NC}"
echo -e "   ${GREEN}sudo systemctl enable vialtros-django${NC}"
echo -e "   ${GREEN}sudo systemctl start vialtros-django${NC}"
echo ""

echo "3. Configurar Apache Virtual Host:"
echo -e "   ${GREEN}sudo cp etc/apache2/vialtros.conf /etc/apache2/sites-available/${NC}"
echo -e "   ${GREEN}sudo a2ensite vialtros${NC}"
echo -e "   ${GREEN}sudo apache2ctl configtest${NC}"
echo -e "   ${GREEN}sudo systemctl restart apache2${NC}"
echo ""

echo "4. Verificar que todo funciona:"
echo -e "   ${GREEN}curl http://vialtros.ds1.eleueleo.com${NC}"
echo -e "   O abre en navegador: ${BLUE}http://vialtros.ds1.eleueleo.com${NC}"
echo ""

echo -e "${YELLOW}Credenciales de prueba:${NC}"
echo -e "   Usuario: ${GREEN}admin${NC}"
echo -e "   Contraseña: ${GREEN}admin123${NC}"
echo ""

echo -e "${YELLOW}Para más información, consulta:${NC}"
echo -e "   ${BLUE}GUIA_DESPLIEGUE_APACHE.txt${NC}"
echo ""
