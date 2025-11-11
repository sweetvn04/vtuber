import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import './VtuberModelDisplay.css';

function VtuberModelDisplay() {
  const containerRef = useRef(null);
  const pixiApp = useRef(null);
  const [status, setStatus] = useState('Đang khởi tạo...');
  const [debugInfo, setDebugInfo] = useState([]);
  const [showDebug, setShowDebug] = useState(true); // State để bật/tắt debug

  const addLog = (message) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    window.PIXI = PIXI;
    
    const modelPath = '/models/akari_vts/akari.model3.json';
    let isMounted = true;

    async function initializePixi() {
      try {
        addLog('=== BẮT ĐẦU KHỞI TẠO ===');
        
        if (!containerRef.current) {
          throw new Error('Container chưa sẵn sàng');
        }

        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        addLog(`Kích thước container: ${w}x${h}`);

        if (w === 0 || h === 0) {
          throw new Error('Container không có kích thước! Kiểm tra CSS của parent component.');
        }

        setStatus('Đang khởi tạo PixiJS...');
        addLog('Đang tạo PIXI.Application...');

        pixiApp.current = new PIXI.Application({
          width: w,
          height: h,
          transparent: true,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        addLog('✓ PIXI.Application đã tạo');

        if (containerRef.current && isMounted) {
          containerRef.current.appendChild(pixiApp.current.view);
          addLog('✓ Canvas đã thêm vào DOM');
        }

        setStatus('Đang tải model Live2D...');
        addLog(`Đang tải model từ: ${modelPath}`);

        const model = await Live2DModel.from(modelPath);
        addLog('✓ Model đã tải thành công');
        
        if (!isMounted || !pixiApp.current) {
          addLog('⚠ Component đã unmount, dừng khởi tạo');
          return;
        }

        pixiApp.current.stage.addChild(model);
        addLog('✓ Model đã thêm vào stage');

        // Log thông tin model GỐC
        addLog(`Model size GỐC: ${model.width}x${model.height}`);
        addLog(`Model position GỐC: (${model.x}, ${model.y})`);
        addLog(`Model scale GỐC: ${model.scale.x}`);

        // Điều chỉnh kích thước - PHÓNG TO HƠN
        const scaleX = w / model.width;
        const scaleY = h / model.height;
        const scale = Math.min(scaleX, scaleY) * 2.0; // Scale 150% màn hình
        
        addLog(`ScaleX: ${scaleX}, ScaleY: ${scaleY}`);
        addLog(`Scale áp dụng: ${scale}`);
        
        model.scale.set(scale);

        // Căn giữa model - ĐƠN GIẢN HƠN
        model.x = w / 2;
        model.y = h / 2;
        // model.anchor.set(0.5, 0.5); // Anchor giữa model
        model.anchor.set(0.5, 0.3); // Anchor giữa model
        
        addLog(`Container: ${w}x${h}`);
        addLog(`Model sau scale: ${model.width * scale}x${model.height * scale}`);
        addLog(`Vị trí cuối: x=${model.x}, y=${model.y}`);
        addLog(`Scale cuối: ${model.scale.x}`);

        // Kiểm tra visibility
        addLog(`Model visible: ${model.visible}`);
        addLog(`Model alpha: ${model.alpha}`);
        addLog(`Stage children: ${pixiApp.current.stage.children.length}`);

        model.interactive = true;
        model.on('pointerdown', () => {
          addLog('🖱️ Model được click!');
        });

        model.on('hit', (hitAreas) => {
          addLog(`👆 Hit areas: ${hitAreas.join(', ')}`);
        });

        setStatus('');
        addLog('=== HOÀN TẤT KHỞI TẠO ===');

      } catch (err) {
        console.error('❌ LỖI:', err);
        addLog(`❌ LỖI: ${err.message}`);
        addLog(`Stack: ${err.stack}`);
        
        if (isMounted) {
          setStatus(`Lỗi: ${err.message}`);
        }
      }
    }

    const timer = setTimeout(() => {
      initializePixi();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      
      if (pixiApp.current) {
        try {
          if (pixiApp.current.view && pixiApp.current.view.parentNode) {
            pixiApp.current.view.parentNode.removeChild(pixiApp.current.view);
          }
          pixiApp.current.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
          });
          pixiApp.current = null;
          addLog('✓ Đã cleanup PixiJS');
        } catch (err) {
          console.error('Lỗi cleanup:', err);
        }
      }
    };
  }, []);

  return (
    <div 
      className="vtuber-display" 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%' 
        }}
      />
      
      {status && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: status.startsWith('Lỗi') ? '#ff4444' : '#ffffff',
          fontSize: '18px',
          fontWeight: 'bold',
          textAlign: 'center',
          padding: '30px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '12px',
          zIndex: 10
        }}>
          {status}
        </div>
      )}

      {/* Nút bật/tắt debug */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: showDebug ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
          border: showDebug ? '2px solid #0f0' : '2px solid #f00',
          color: '#fff',
          padding: '8px 15px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          zIndex: 101,
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(5px)'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
      >
        {showDebug ? '🐛 Hide Debug' : '🐛 Show Debug'}
      </button>

      {/* Debug panel - Hiển thị khi showDebug = true */}
      {showDebug && (
        <div style={{
          position: 'absolute',
          top: 50,
          right: 10,
          background: 'rgba(0, 0, 0, 0.9)',
          color: '#0f0',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '11px',
          fontFamily: 'monospace',
          maxHeight: '400px',
          overflowY: 'auto',
          maxWidth: '450px',
          zIndex: 100,
          border: '1px solid #0f0',
          boxShadow: '0 4px 6px rgba(0, 255, 0, 0.1)'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '8px', 
            color: '#fff',
            borderBottom: '1px solid #333',
            paddingBottom: '5px'
          }}>
            📊 DEBUG LOG ({debugInfo.length} entries):
          </div>
          {debugInfo.length === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>
              No logs yet...
            </div>
          ) : (
            debugInfo.map((log, i) => (
              <div key={i} style={{ 
                marginBottom: '3px',
                paddingLeft: '5px',
                borderLeft: log.includes('✓') ? '3px solid #0f0' : 
                            log.includes('❌') ? '3px solid #f00' : 
                            log.includes('⚠') ? '3px solid #ff0' : '3px solid #333',
                color: log.includes('✓') ? '#0f0' : 
                       log.includes('❌') ? '#f00' : 
                       log.includes('⚠') ? '#ff0' : '#fff'
              }}>
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default VtuberModelDisplay;