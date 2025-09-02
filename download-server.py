#!/usr/bin/env python3
import http.server
import socketserver
import os
from urllib.parse import unquote

class FileHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='/app', **kwargs)
    
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            
            html = """
            <!DOCTYPE html>
            <html lang="hu">
            <head>
                <meta charset="UTF-8">
                <title>Turbó Szerviz Desktop App Letöltés</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                    .download-box { background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 10px; padding: 30px; text-align: center; }
                    .download-btn { background: #3b82f6; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 18px; cursor: pointer; text-decoration: none; display: inline-block; }
                    .download-btn:hover { background: #2563eb; }
                    .file-info { background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <h1>🔧 Turbó Szerviz Kezelő - Desktop App</h1>
                
                <div class="download-box">
                    <h2>📦 Letöltés kész!</h2>
                    
                    <div class="file-info">
                        <strong>Fájl:</strong> Turbo-Szerviz-Desktop-App.tar.gz<br>
                        <strong>Méret:</strong> 146 MB<br>
                        <strong>Tartalom:</strong> Teljes Windows desktop alkalmazás
                    </div>
                    
                    <a href="/Turbo-Szerviz-Desktop-App.tar.gz" class="download-btn" download>
                        💾 Letöltés indítása
                    </a>
                </div>
                
                <h3>📋 Telepítési útmutató:</h3>
                <ol>
                    <li>Töltsd le a fájlt</li>
                    <li>Csomagold ki (WinRAR, 7-Zip, stb.)</li>
                    <li>Futtasd a <code>Turbó Szerviz Kezelő.exe</code> fájlt</li>
                    <li>Élvezd a teljes offline alkalmazást! 🎉</li>
                </ol>
                
                <h3>✨ Funkciók:</h3>
                <ul>
                    <li>✅ Teljes offline működés</li>
                    <li>✅ Ügyfelek kezelése</li>
                    <li>✅ Munkalapok létrehozása</li>
                    <li>✅ Raktárkezelés</li>
                    <li>✅ PDF jelentések</li>
                    <li>✅ Helyi SQLite adatbázis</li>
                </ul>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            super().do_GET()

PORT = 9000
Handler = FileHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"🌐 Letöltési szerver fut: http://localhost:{PORT}")
    print(f"📁 Fájlok: /app/ mappából")
    print(f"💾 Desktop app: http://localhost:{PORT}/Turbo-Szerviz-Desktop-App.tar.gz")
    httpd.serve_forever()