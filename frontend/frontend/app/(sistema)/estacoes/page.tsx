"use client";

import React, { useMemo, useState } from "react";
import styles from "./App.module.css";

type Sensor = {
    id: string;
    nome: string;
    tipo: string;
    unidade: string;
};

type Estacao = {
    nome: string;
    codigo: string;
    latitude: number;
    longitude: number;
    status: string;
    statusClass: string;
    endereco: string;
    sensores: Sensor[];
};

type StatusOperacional = "ativo" | "inativo";

const tiposSensores = [
    "Temperatura",
    "Umidade",
    "Pressão",
    "Velocidade do vento",
    "Nível de água",
    "Radiação",
];

const unidadesMedida = ["°C", "%", "hPa", "m/s", "V", "A", "mm"];

const estacoesBase: Estacao[] = [
    {
        nome: "Sem resposta do turno",
        codigo: "123e4567-e89b-12d3-a456-426655440000",
        latitude: -23.5505,
        longitude: -46.6333,
        status: "Ativo",
        statusClass: styles.active,
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-001", nome: "Sensor temperatura 01", tipo: "Temperatura", unidade: "°C" },
            { id: "S-002", nome: "Sensor temperatura 02", tipo: "Temperatura", unidade: "°C" },
            { id: "S-003", nome: "Sensor umidade 01", tipo: "Umidade", unidade: "%" },
            { id: "S-004", nome: "Sensor umidade 02", tipo: "Umidade", unidade: "%" },
            { id: "S-005", nome: "Sensor velocidade 01", tipo: "Velocidade do vento", unidade: "m/s" },
            { id: "S-006", nome: "Sensor velocidade 02", tipo: "Velocidade do vento", unidade: "m/s" },
            { id: "S-007", nome: "Sensor pressão 01", tipo: "Pressão", unidade: "hPa" },
            { id: "S-008", nome: "Sensor pressão 02", tipo: "Pressão", unidade: "hPa" },
            { id: "S-009", nome: "Sensor pressão 03", tipo: "Pressão", unidade: "hPa" },
            { id: "S-010", nome: "Sensor radiação 01", tipo: "Radiação", unidade: "V" },
            { id: "S-011", nome: "Sensor radiação 02", tipo: "Radiação", unidade: "V" },
            { id: "S-012", nome: "Sensor nível 01", tipo: "Nível de água", unidade: "mm" },
        ],
    },
    {
        nome: "Sinal fora da faixa",
        codigo: "550e8400-e29b-41d4-a716-446655440000",
        latitude: -23.5487,
        longitude: -46.6321,
        status: "Ativo",
        statusClass: styles.active,
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-013", nome: "Sensor temperatura 03", tipo: "Temperatura", unidade: "°C" },
            { id: "S-014", nome: "Sensor temperatura 04", tipo: "Temperatura", unidade: "°C" },
            { id: "S-015", nome: "Sensor umidade 03", tipo: "Umidade", unidade: "%" },
            { id: "S-016", nome: "Sensor umidade 04", tipo: "Umidade", unidade: "%" },
            { id: "S-017", nome: "Sensor pressão 04", tipo: "Pressão", unidade: "hPa" },
            { id: "S-018", nome: "Sensor radiação 03", tipo: "Radiação", unidade: "V" },
            { id: "S-019", nome: "Sensor nível 02", tipo: "Nível de água", unidade: "mm" },
            { id: "S-020", nome: "Sensor nível 03", tipo: "Nível de água", unidade: "mm" },
        ],
    },
    {
        nome: "Estoque de bateria baixo",
        codigo: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        latitude: -23.5519,
        longitude: -46.6301,
        status: "Ativo",
        statusClass: styles.active,
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-021", nome: "Sensor umidade 05", tipo: "Umidade", unidade: "%" },
            { id: "S-022", nome: "Sensor umidade 06", tipo: "Umidade", unidade: "%" },
            { id: "S-023", nome: "Sensor pressão 05", tipo: "Pressão", unidade: "hPa" },
            { id: "S-024", nome: "Sensor nível 04", tipo: "Nível de água", unidade: "mm" },
            { id: "S-025", nome: "Sensor temperatura 05", tipo: "Temperatura", unidade: "°C" },
        ],
    },
    {
        nome: "Discrepância de registro",
        codigo: "9c858901-8a57-4791-81fe-4c455b099bc9",
        latitude: -23.5534,
        longitude: -46.6342,
        status: "Não Ativo",
        statusClass: styles.notActive,
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-026", nome: "Sensor temperatura 06", tipo: "Temperatura", unidade: "°C" },
            { id: "S-027", nome: "Sensor temperatura 07", tipo: "Temperatura", unidade: "°C" },
            { id: "S-028", nome: "Sensor umidade 07", tipo: "Umidade", unidade: "%" },
            { id: "S-029", nome: "Sensor umidade 08", tipo: "Umidade", unidade: "%" },
            { id: "S-030", nome: "Sensor umidade 09", tipo: "Umidade", unidade: "%" },
            { id: "S-031", nome: "Sensor pressão 06", tipo: "Pressão", unidade: "hPa" },
            { id: "S-032", nome: "Sensor pressão 07", tipo: "Pressão", unidade: "hPa" },
            { id: "S-033", nome: "Sensor pressão 08", tipo: "Pressão", unidade: "hPa" },
            { id: "S-034", nome: "Sensor nível 05", tipo: "Nível de água", unidade: "mm" },
            { id: "S-035", nome: "Sensor nível 06", tipo: "Nível de água", unidade: "mm" },
        ],
    },
];

const ITENS_POR_PAGINA = 5;

export default function Estacoes() {
    const [estacoes, setEstacoes] = useState<Estacao[]>(estacoesBase);
    const [pesquisa, setPesquisa] = useState("");
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [modalAberto, setModalAberto] = useState(false);
    const [modoEdicao, setModoEdicao] = useState<"cadastro" | "edicao">("cadastro");
    const [estacaoSelecionada, setEstacaoSelecionada] = useState<Estacao | null>(null);
    const [nome, setNome] = useState("");
    const [uuid, setUuid] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [endereco, setEndereco] = useState("");
    const [statusOperacional, setStatusOperacional] = useState<StatusOperacional>("ativo");
    const [menuAbertoCodigo, setMenuAbertoCodigo] = useState<string | null>(null);
    const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string | null>(null);
    const [modalAssociacaoAberto, setModalAssociacaoAberto] = useState(false);
    const [estacaoAssociada, setEstacaoAssociada] = useState<Estacao | null>(null);
    const [tipoSensor, setTipoSensor] = useState("Temperatura");
    const [unidadeMedidaSelecionada, setUnidadeMedidaSelecionada] = useState("°C");
    const [nomeSensor, setNomeSensor] = useState("");
    const [listaSensores, setListaSensores] = useState<Sensor[]>([]);

    const estacoesFiltradas = useMemo(() => {
        const termo = pesquisa.trim().toLowerCase();

        if (!termo) {
            return estacoes;
        }

        return estacoes.filter((estacao) => {
            const nomeEstacao = estacao.nome.toLowerCase();
            const codigo = estacao.codigo.toLowerCase();

            return nomeEstacao.includes(termo) || codigo.includes(termo);
        });
    }, [pesquisa, estacoes]);

    const totalPaginas = Math.max(1, Math.ceil(estacoesFiltradas.length / ITENS_POR_PAGINA));

    const paginaSegura = Math.min(paginaAtual, totalPaginas);
    const indiceInicial = (paginaSegura - 1) * ITENS_POR_PAGINA;
    const estacoesPagina = estacoesFiltradas.slice(
        indiceInicial,
        indiceInicial + ITENS_POR_PAGINA
    );

    const indiceFinal = Math.min(
        indiceInicial + estacoesPagina.length,
        estacoesFiltradas.length
    );

    const limparFormulario = () => {
        setNome("");
        setUuid("");
        setLatitude("");
        setLongitude("");
        setEndereco("");
        setStatusOperacional("ativo");
    };

    const resetarAssociacao = () => {
        setTipoSensor("Temperatura");
        setUnidadeMedidaSelecionada("°C");
        setNomeSensor("");
        setListaSensores([]);
    };

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

    const abrirModal = () => {
        setModoEdicao("cadastro");
        setEstacaoSelecionada(null);
        limparFormulario();
        setModalAberto(true);
        setMenuAbertoCodigo(null);
    };

    const abrirModalEdicao = (estacao: Estacao) => {
        setModoEdicao("edicao");
        setEstacaoSelecionada(estacao);
        setNome(estacao.nome);
        setUuid(estacao.codigo);
        setLatitude(String(estacao.latitude));
        setLongitude(String(estacao.longitude));
        setEndereco(estacao.endereco);
        setStatusOperacional(estacao.status === "Ativo" ? "ativo" : "inativo");
        setModalAberto(true);
        setMenuAbertoCodigo(null);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setModoEdicao("cadastro");
        setEstacaoSelecionada(null);
        limparFormulario();
    };

    const abrirModalAssociacao = (estacao: Estacao) => {
        setEstacaoAssociada(estacao);
        setTipoSensor(estacao.sensores[0]?.tipo ?? "Temperatura");
        setUnidadeMedidaSelecionada(estacao.sensores[0]?.unidade ?? "°C");
        setListaSensores(estacao.sensores);
        setNomeSensor("");
        setModalAssociacaoAberto(true);
        setMenuAbertoCodigo(null);
    };

    const fecharModalAssociacao = () => {
        setModalAssociacaoAberto(false);
        setEstacaoAssociada(null);
        resetarAssociacao();
    };

    const adicionarSensorLista = () => {
        const sensorLimpo = nomeSensor.trim();

        if (!sensorLimpo) {
            return;
        }

        setListaSensores((listaAtuais) => {
            if (listaAtuais.some((sensor) => sensor.nome === sensorLimpo)) {
                return listaAtuais;
            }

            return [
                ...listaAtuais,
                {
                    id: `S-${Date.now()}`,
                    nome: sensorLimpo,
                    tipo: tipoSensor,
                    unidade: unidadeMedidaSelecionada,
                },
            ];
        });
        setNomeSensor("");
    };

    const removerSensorLista = (id: string) => {
        setListaSensores((listaAtuais) => listaAtuais.filter((sensor) => sensor.id !== id));
    };

    const salvarAssociacao = () => {
        if (!estacaoAssociada || listaSensores.length === 0) {
            return;
        }

        setEstacoes((lista) =>
            lista.map((estacao) =>
                estacao.codigo === estacaoAssociada.codigo
                    ? { ...estacao, sensores: listaSensores }
                    : estacao
            )
        );

        fecharModalAssociacao();
    };

    const cadastrarEstacao = () => {
        const nomeDaEstacao = nome.trim();

        if (!nomeDaEstacao) {
            return;
        }

        const codigo = uuid.trim() || `EST-${Math.floor(1000 + Math.random() * 9000)}`;
        const statusFinal = statusOperacional === "ativo" ? "Ativo" : "Não Ativo";
        const statusClass = statusOperacional === "ativo" ? styles.active : styles.notActive;
        const novoEndereco = endereco.trim() || "Endereço não informado";

        if (modoEdicao === "edicao" && estacaoSelecionada) {
            setEstacoes((lista) =>
                lista.map((estacao) =>
                    estacao.codigo === estacaoSelecionada.codigo
                        ? {
                              ...estacao,
                              nome: nomeDaEstacao,
                              codigo,
                              latitude: Number(latitude) || estacao.latitude,
                              longitude: Number(longitude) || estacao.longitude,
                              status: statusFinal,
                              statusClass,
                              endereco: novoEndereco,
                          }
                        : estacao
                )
            );
            fecharModal();
            return;
        }

        const novaEstacao: Estacao = {
            nome: nomeDaEstacao,
            codigo,
            latitude: Number(latitude) || -23.5505,
            longitude: Number(longitude) || -46.6333,
            status: statusFinal,
            statusClass,
            endereco: novoEndereco,
            sensores: [],
        };

        setEstacoes((lista) => [novaEstacao, ...lista]);
        setPesquisa("");
        setPaginaAtual(1);
        fecharModal();
    };

    const confirmarExclusao = (codigo: string) => {
        setConfirmacaoExclusao(codigo);
        setMenuAbertoCodigo(null);
    };

    const excluirEstacao = () => {
        if (!confirmacaoExclusao) {
            return;
        }

        setEstacoes((lista) =>
            lista.filter((estacao) => estacao.codigo !== confirmacaoExclusao)
        );
        setConfirmacaoExclusao(null);
    };

    const renderizarContagemSensores = (estacao: Estacao) => {
        const total = estacao.sensores.length;

        if (total === 0) {
            return "0 sensores";
        }

        return `${total} ${total === 1 ? "sensor" : "sensores"}`;
    };

    return (
        <div>
            <div className={styles.Header}>
                <div className={styles.alertaTitulos}>
                    <h1 className={styles.title}>Estações</h1>

                    <span className={styles.subtitle}>
                        Acompanhe e gerencie as estações do sistema.
                    </span>
                </div>

                <button className={styles.newButton} type="button" onClick={abrirModal}>
                    <span>＋</span>
                    Nova Estação
                </button>
            </div>

            <br />
            <br />

            <input
                placeholder="Buscar por estação ou código"
                className={styles.searchBar}
                value={pesquisa}
                onChange={handlePesquisa}
            />
            <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                    <span>Estações</span>
                    <button className={styles.exportButton} type="button">
                        Exportar
                    </button>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ESTAÇÃO</th>
                            <th>LATITUDE/LONGITUDE</th>
                            <th>STATUS</th>
                            <th>SENSORES</th>
                            <th>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {estacoesPagina.map((estacao) => (
                            <tr key={estacao.codigo}>
                                <td className={styles.nameCell}>
                                    <span className={styles.alertName}>{estacao.nome}</span>
                                    <span className={styles.alertCode}>{estacao.codigo}</span>
                                </td>
                                <td>
                                    {estacao.latitude}, {estacao.longitude}
                                </td>
                                <td>
                                    <span className={`${styles.severity} ${estacao.statusClass}`}>
                                        <span className={styles.dot} aria-hidden="true" />
                                        {estacao.status}
                                    </span>
                                </td>
                                <td>{renderizarContagemSensores(estacao)}</td>
                                <td className={styles.actionsCell}>
                                    <div className={styles.actionsContent}>
                                        <button
                                            className={styles.checkButton}
                                            type="button"
                                            aria-label={`Associar sensores à ${estacao.nome}`}
                                            onClick={() => abrirModalAssociacao(estacao)}
                                        >
                                            +
                                        </button>

                                        <div className={styles.actionWrapper}>
                                            <button
                                                className={styles.moreButton}
                                                type="button"
                                                aria-label={`Mais opções para ${estacao.nome}`}
                                                onClick={() =>
                                                    setMenuAbertoCodigo(
                                                        menuAbertoCodigo === estacao.codigo ? null : estacao.codigo
                                                    )
                                                }
                                            >
                                                …
                                            </button>

                                            {menuAbertoCodigo === estacao.codigo && (
                                                <div className={styles.actionMenu} role="menu">
                                                    <button
                                                        type="button"
                                                        className={styles.actionMenuButton}
                                                        onClick={() => abrirModalEdicao(estacao)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionMenuButton} ${styles.actionMenuButtonDanger}`}
                                                        onClick={() => confirmarExclusao(estacao.codigo)}
                                                    >
                                                        Deletar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className={styles.paginacao}>
                    <span>
                        {estacoesFiltradas.length === 0
                            ? "Sem resultados"
                            : `${Math.min(indiceInicial + 1, estacoesFiltradas.length)}-${indiceFinal} de ${estacoesFiltradas.length}`}
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

                        <h2 className={styles.modalTitle}>
                            {modoEdicao === "edicao" ? "Editar estação" : "Cadastrar estação"}
                        </h2>

                        <label className={styles.fieldLabel}>
                            Nome
                            <input
                                type="text"
                                value={nome}
                                onChange={(event) => setNome(event.target.value)}
                                className={styles.inputField}
                            />
                        </label>

                        <label className={styles.fieldLabel}>
                            UUID/MAC
                            <input
                                type="text"
                                value={uuid}
                                onChange={(event) => setUuid(event.target.value)}
                                className={styles.inputField}
                            />
                        </label>

                        <div className={styles.formRow}>
                            <label className={styles.fieldLabel}>
                                Latitude
                                <input
                                    type="number"
                                    step="any"
                                    value={latitude}
                                    onChange={(event) => setLatitude(event.target.value)}
                                    placeholder="Ex: -23.5505"
                                    className={styles.inputField}
                                />
                            </label>

                            <label className={styles.fieldLabel}>
                                Longitude
                                <input
                                    type="number"
                                    step="any"
                                    value={longitude}
                                    onChange={(event) => setLongitude(event.target.value)}
                                    placeholder="Ex: -46.6333"
                                    className={styles.inputField}
                                />
                            </label>
                        </div>

                        <label className={styles.fieldLabel}>
                            Endereço/Região
                            <input
                                type="text"
                                value={endereco}
                                onChange={(event) => setEndereco(event.target.value)}
                                className={styles.inputField}
                            />
                        </label>

                        <div className={styles.formRow}>
                            <label className={styles.fieldLabel}>
                                Status Operacional
                                <select
                                    value={statusOperacional}
                                    onChange={(event) => setStatusOperacional(event.target.value as StatusOperacional)}
                                    className={styles.selectField}
                                >
                                    <option value="ativo">Ativo</option>
                                    <option value="inativo">Não Ativo</option>
                                </select>
                            </label>
                        </div>

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.cancelButton} onClick={fecharModal}>
                                Cancelar
                            </button>
                            <button type="button" className={styles.submitButton} onClick={cadastrarEstacao}>
                                {modoEdicao === "edicao" ? "Salvar" : "Cadastrar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalAssociacaoAberto && estacaoAssociada && (
                <div className={styles.modalOverlay} onClick={fecharModalAssociacao}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            className={styles.closeButton}
                            aria-label="Fechar modal de associação"
                            onClick={fecharModalAssociacao}
                        >
                            ×
                        </button>

                        <h2 className={styles.modalTitle}>Sensores da estação</h2>
                        <p className={styles.modalSubtitle}>{estacaoAssociada.nome}</p>

                        <div className={styles.formRow}>
                            <label className={styles.fieldLabel}>
                                Tipo
                                <select
                                    value={tipoSensor}
                                    onChange={(event) => setTipoSensor(event.target.value)}
                                    className={styles.selectField}
                                >
                                    {tiposSensores.map((tipo) => (
                                        <option key={tipo} value={tipo}>
                                            {tipo}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className={styles.fieldLabel}>
                                Unidade de medida
                                <select
                                    value={unidadeMedidaSelecionada}
                                    onChange={(event) => setUnidadeMedidaSelecionada(event.target.value)}
                                    className={styles.selectField}
                                >
                                    {unidadesMedida.map((unidade) => (
                                        <option key={unidade} value={unidade}>
                                            {unidade}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className={styles.fieldLabel}>
                            Lista de sensores
                            <div className={styles.sensorInputRow}>
                                <input
                                    type="text"
                                    value={nomeSensor}
                                    onChange={(event) => setNomeSensor(event.target.value)}
                                    placeholder="Digite o nome do sensor"
                                    className={styles.inputField}
                                />
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={adicionarSensorLista}
                                >
                                    Adicionar
                                </button>
                            </div>
                        </label>

                        <div className={styles.sensorList}>
                            {listaSensores.length === 0 ? (
                                <span className={styles.emptySensors}>Nenhum sensor adicionado</span>
                            ) : (
                                <>
                                    <div className={styles.sensorListHeader}>
                                        <span>ID</span>
                                        <span>Nome</span>
                                        <span>Tipo</span>
                                        <span>Unidade</span>
                                        <span />
                                    </div>
                                    {listaSensores.map((sensor) => (
                                        <div key={sensor.id} className={styles.sensorListRow}>
                                            <span className={styles.sensorListValue}>{sensor.id}</span>
                                            <span className={styles.sensorListValue}>{sensor.nome}</span>
                                            <span className={styles.sensorListValue}>{sensor.tipo}</span>
                                            <span className={styles.sensorListValue}>{sensor.unidade}</span>
                                            <button
                                                type="button"
                                                className={styles.removeSensorButton}
                                                aria-label={`Remover ${sensor.nome}`}
                                                onClick={() => removerSensorLista(sensor.id)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.cancelButton} onClick={fecharModalAssociacao}>
                                Cancelar
                            </button>
                            <button type="button" className={styles.submitButton} onClick={salvarAssociacao}>
                                Salvar sensores
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmacaoExclusao && (
                <div className={styles.modalOverlay} onClick={() => setConfirmacaoExclusao(null)}>
                    <div className={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
                        <h2 className={styles.confirmTitle}>Confirmar exclusão</h2>
                        <p className={styles.confirmText}>
                            Tem certeza que deseja deletar esta estação? Essa ação não pode ser desfeita.
                        </p>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => setConfirmacaoExclusao(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={`${styles.submitButton} ${styles.deleteButton}`}
                                onClick={excluirEstacao}
                            >
                                Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}