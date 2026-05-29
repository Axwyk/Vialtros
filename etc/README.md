# Configuraciones de Servidor

Este directorio contiene los archivos de configuración necesarios para desplegar Vialtros en Apache.

## Contenido

### Apache (apache2/)

- **vialtros.conf**: Virtual host de Apache que configura:
  - Proxy inverso para Django (Gunicorn en puerto 8000)
  - Servir React build como frontend
  - WebSocket para tracking en tiempo real
  - Headers de seguridad
  - Caché para archivos estáticos

### Systemd (systemd/)

- **vialtros-django.service**: Service para ejecutar Django/Gunicorn como daemon:
  - Inicia automáticamente al arrancar el servidor
  - Reinicia automáticamente si hay fallos
  - Logs en journalctl

## Cómo usar

### 1. Instalar Virtual Host de Apache

```bash
sudo cp etc/apache2/vialtros.conf /etc/apache2/sites-available/
sudo a2ensite vialtros.conf
sudo apache2ctl configtest
sudo systemctl restart apache2
```

### 2. Instalar Systemd Service

```bash
sudo cp etc/systemd/vialtros-django.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vialtros-django.service
sudo systemctl start vialtros-django.service
```

### 3. Verificar que todo funciona

```bash
sudo systemctl status vialtros-django.service
sudo systemctl status apache2
sudo journalctl -u vialtros-django.service -f
```

## Para más información

Ver: `GUIA_DESPLIEGUE_APACHE.txt` en la raíz del proyecto
