// src/components/VtuberModelDisplay.js

import React from 'react';
import './VtuberModelDisplay.css';

const VtuberModelDisplay = () => {
  return (
    <div className="vtuber-display">
      <h3>Model AI VTuber</h3>
      <div className="model-placeholder">
        {/*
          Đây là nơi bạn sẽ nhúng thư viện 3D (ví dụ: Three.js, Live2D, Kalidoface)
          để hiển thị model VTuber của bạn.
        */}
        <p>[Model VTuber sẽ hiển thị ở đây]</p>
      </div>
    </div>
  );
};

export default VtuberModelDisplay;