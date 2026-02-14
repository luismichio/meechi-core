'use client';
import { useState, useEffect } from 'react';
import { useYjs } from './YjsProvider';
export function useYDoc() {
    const { doc, synced } = useYjs();
    return { doc, synced };
}
export function useYMap(name) {
    const { doc } = useYjs();
    const map = doc.getMap(name);
    const [toJSON, setToJSON] = useState(map.toJSON());
    useEffect(() => {
        const onChange = () => {
            setToJSON(map.toJSON());
        };
        map.observe(onChange);
        return () => {
            map.unobserve(onChange);
        };
    }, [map]);
    return [map, toJSON];
}
export function useYArray(name) {
    const { doc } = useYjs();
    const array = doc.getArray(name);
    const [toJSON, setToJSON] = useState(array.toArray());
    useEffect(() => {
        const onChange = () => {
            setToJSON(array.toArray());
        };
        array.observe(onChange);
        return () => {
            array.unobserve(onChange);
        };
    }, [array]);
    return [array, toJSON];
}
