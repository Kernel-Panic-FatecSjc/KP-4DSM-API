"use client";

import React, { useMemo, useState } from "react";
import styles from "./App.module.css";

const alertasBase = [
    {
        nome: "Sem resposta do turno",
        codigo: "AL-2841",
        estagio: "Processo",
        severidade: "crítico",
        tempo: "3 min",
        severidadeClass: styles.critical,
    },
    {
        nome: "Sinal fora da faixa",
        codigo: "AL-2848",
        estagio: "Entrada",
        severidade: "alto",
        tempo: "11 min",
        severidadeClass: styles.high,
    },
    {
        nome: "Estoque de bateria baixo",
        codigo: "AL-2838",
        estagio: "Fechamento",
        severidade: "normal",
        tempo: "34 min",
        severidadeClass: styles.normal,
    },
    {
        nome: "Discrepância de registro",
        codigo: "AL-2835",
        estagio: "Processo",
        severidade: "alto",
        tempo: "1 h",
        severidadeClass: styles.high,
    },
    {
        nome: "Operador desconectado",
        codigo: "AL-2831",
        estagio: "Entrada",
        severidade: "normal",
        tempo: "2 h",
        severidadeClass: styles.normal,
    },
    {
        nome: "Sensor com falha",
        codigo: "AL-2810",
        estagio: "Entrada",
        severidade: "crítico",
        tempo: "5 h",
        severidadeClass: styles.critical,
    },
    {
        nome: "Pedido atrasado",
        codigo: "AL-2874",
        estagio: "Processo",
        severidade: "alto",
        tempo: "7 h",
        severidadeClass: styles.high,
    },
    {
        nome: "Inventário divergente",
        codigo: "AL-2891",
        estagio: "Fechamento",
        severidade: "normal",
        tempo: "9 h",
        severidadeClass: styles.normal,
    },
];

const ITENS_POR_PAGINA = 5;

export default function Alertas() {
    const [alertas, setAlertas] = useState(alertasBase);
    const [pesquisa, setPesquisa] = useState("");
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [modalAberto, setModalAberto] = useState(false);
    const [descricao, setDescricao] = useState("");
    const [estagio, setEstagio] = useState("Entrada");
    const [severidade, setSeveridade] = useState("Alto");

    const alertasFiltrados = useMemo(() => {
        const termo = pesquisa.trim().toLowerCase();

        if (!termo) {
            return alertas;
        }

        return alertas.filter((alerta) => {
            const nome = alerta.nome.toLowerCase();
            const codigo = alerta.codigo.toLowerCase();

            return nome.includes(termo) || codigo.includes(termo);
        });
    }, [pesquisa, alertas]);

    const totalPaginas = Math.max(
        1,
        Math.ceil(alertasFiltrados.length / ITENS_POR_PAGINA)
    );

    const paginaSegura = Math.min(paginaAtual, totalPaginas);
    const indiceInicial = (paginaSegura - 1) * ITENS_POR_PAGINA;
    const alertasPagina = alertasFiltrados.slice(
        indiceInicial,
        indiceInicial + ITENS_POR_PAGINA
    );

    const handlePesquisa = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPesquisa(event.target.value);
        setPaginaAtual(1);
    };

    const proximaPagina = () => {
        setPaginaAtual((atual) => Math.min(atual + 1, totalPaginas));
    };

    const paginaAnterior = () => {
        setPaginaAtual((atual) => Math.max(atual - 1, 1));
    };

    const indiceFinal = Math.min(
        indiceInicial + alertasPagina.length,
        alertasFiltrados.length
    );

    const abrirModal = () => setModalAberto(true);

    const fecharModal = () => {
        setModalAberto(false);
        setDescricao("");
        setEstagio("Entrada");
        setSeveridade("Alto");
    };

    const cadastrarAlerta = () => {
        const texto = descricao.trim();

        if (!texto) {
            return;
        }

        const novoCodigo = `AL-${Math.floor(1000 + Math.random() * 9000)}`;
        const severidadeFinal = severidade.toLowerCase();

        const novoAlerta = {
            nome: texto,
            codigo: novoCodigo,
            estagio,
            severidade: severidadeFinal,
            tempo: "agora",
            severidadeClass:
                severidadeFinal === "crítico"
                    ? styles.critical
                    : severidadeFinal === "alto"
                        ? styles.high
                        : styles.normal,
        };

        setAlertas((lista) => [novoAlerta, ...lista]);
        setPesquisa("");
        setPaginaAtual(1);
        fecharModal();
    };

    return (
        <div>
            <div className={styles.Header}>
                <div className={styles.alertaTitulos}>
                    <h1 className={styles.title}>Alertas</h1>

                    <span className={styles.subtitle}>
                        Acompanhe e resolva ocorrências operacionais.
                    </span>
                </div>

                <button className={styles.newButton} type="button" onClick={abrirModal}>
                    <span>＋</span>
                    Novo alerta
                </button>
            </div>

            <br />
            <br />

            <input
                placeholder="Buscar por alerta"
                className={styles.searchBar}
                value={pesquisa}
                onChange={handlePesquisa}
            />
            <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                    <span>Alertas</span>
                    <button className={styles.exportButton} type="button">
                        Exportar
                    </button>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ALERTA</th>
                            <th>ESTÁGIO</th>
                            <th>SEVERIDADE</th>
                            <th>TEMPO</th>
                            <th>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {alertasPagina.map((alerta) => (
                            <tr key={alerta.codigo}>
                                <td className={styles.nameCell}>
                                    <span className={styles.alertName}>{alerta.nome}</span>
                                    <span className={styles.alertCode}>{alerta.codigo}</span>
                                </td>
                                <td>{alerta.estagio}</td>
                                <td>
                                    <span className={`${styles.severity} ${alerta.severidadeClass}`}>
                                        <span className={styles.dot} aria-hidden="true" />
                                        {alerta.severidade}
                                    </span>
                                </td>
                                <td>{alerta.tempo}</td>
                                <td className={styles.actionsCell}>
                                    <button className={styles.checkButton} type="button" aria-label={`Marcar ${alerta.nome}`}>
                                        ✓
                                    </button>
                                    <button className={styles.moreButton} type="button" aria-label={`Mais opções para ${alerta.nome}`}>
                                        …
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className={styles.paginacao}>
                    <span>
                        {alertasFiltrados.length === 0
                            ? "Sem resultados"
                            : `${Math.min(indiceInicial + 1, alertasFiltrados.length)}-${indiceFinal} de ${alertasFiltrados.length}`}
                    </span>
                    <div className={styles.pagControls}>
                        <button
                            type="button"
                            aria-label="Página anterior"
                            className={styles.pagButton}
                            onClick={paginaAnterior}
                            disabled={paginaSegura === 1}
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            aria-label="Próxima página"
                            className={styles.pagButton}
                            onClick={proximaPagina}
                            disabled={paginaSegura === totalPaginas}
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            {modalAberto && (
                <div className={styles.modalOverlay} onClick={fecharModal}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            className={styles.closeButton}
                            aria-label="Fechar modal"
                            onClick={fecharModal}
                        >
                            ×
                        </button>

                        <h2 className={styles.modalTitle}>Cadastrar alerta</h2>
                        <p className={styles.modalSubtitle}>
                            Registre uma ocorrência para acompanhamento da equipe.
                        </p>

                        <label className={styles.fieldLabel}>
                            Descrição
                            <input
                                type="text"
                                value={descricao}
                                onChange={(event) => setDescricao(event.target.value)}
                                placeholder="Ex.: Sinal fora da faixa"
                                className={styles.inputField}
                            />
                        </label>

                        <div className={styles.formRow}>
                            <label className={styles.fieldLabel}>
                                Estágio
                                <select
                                    value={estagio}
                                    onChange={(event) => setEstagio(event.target.value)}
                                    className={styles.selectField}
                                >
                                    <option value="Entrada">Entrada</option>
                                    <option value="Processo">Processo</option>
                                    <option value="Fechamento">Fechamento</option>
                                </select>
                            </label>

                            <label className={styles.fieldLabel}>
                                Severidade
                                <select
                                    value={severidade}
                                    onChange={(event) => setSeveridade(event.target.value)}
                                    className={styles.selectField}
                                >
                                    <option value="Alto">Alto</option>
                                    <option value="Crítico">Crítico</option>
                                    <option value="Normal">Normal</option>
                                </select>
                            </label>
                        </div>

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.cancelButton} onClick={fecharModal}>
                                Cancelar
                            </button>
                            <button type="button" className={styles.submitButton} onClick={cadastrarAlerta}>
                                Cadastrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}