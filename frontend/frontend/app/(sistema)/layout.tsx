"use client";

import { useState } from "react";

import Navbar from "@/components/layout/Navbar/page";
import Header from "@/components/layout/Header/page";

import styles from "./layout.module.css";

export default function SistemaLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [menuMinimizado, setMenuMinimizado] = useState(false);

    return (
        <div className={styles.layout}>

            <Navbar
                minimizado={menuMinimizado}
            />

            <div
                className={`${styles.main} ${
                    menuMinimizado
                        ? styles.mainMinimizada
                        : ""
                }`}
            >

                <Header
                    minimizado={menuMinimizado}
                    setMinimizado={setMenuMinimizado}
                />

                <main className={styles.conteudo}>
                    {children}
                </main>

            </div>

        </div>
    );
}