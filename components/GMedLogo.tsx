import React from 'react';

interface GMedLogoProps {
    className?: string;
    size?: number;
    colorClass?: string;
}

export const GMedLogo: React.FC<GMedLogoProps> = ({ 
    className = "", 
    size = 24, 
    colorClass = "text-[#0077b6]" 
}) => {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            className={`${colorClass} ${className}`}
            style={{ width: size, height: size }}
        >
            <text 
                x="50%" 
                y="56%" 
                dominantBaseline="middle" 
                textAnchor="middle" 
                fontSize="18" 
                fontWeight="900" 
                fontFamily="Inter, system-ui, -apple-system, sans-serif"
                fill="currentColor"
            >
                G
            </text>
        </svg>
    );
};

