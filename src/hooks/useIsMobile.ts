import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Check initially
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth <= breakpoint);
        };

        checkIsMobile();

        // Add listener for resize
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, [breakpoint]);

    return isMobile;
}
