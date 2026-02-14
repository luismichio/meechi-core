import React from 'react';
interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    size?: number | string;
    className?: string;
    color?: string;
}
export default function Icon({ name, size, className, color, ...props }: IconProps): import("react/jsx-runtime").JSX.Element | null;
export {};
