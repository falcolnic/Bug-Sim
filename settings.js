const presetDefinitions = {
    langtons: {
        name: "Langton's Ant",
        rules: {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 },
                { writeColor: 0, move: 'L', nextState: 0 }
            ]
        }
    },
    constructor: {
        name: "Constructor",
        rules: {
            "0": [
                { writeColor: 0, move: "S", nextState: 2 },
                { writeColor: 0, move: "S", nextState: 2 }
            ],
            "1": [
                { writeColor: 1, move: "L", nextState: 2 },
                { writeColor: 0, move: "R", nextState: 1 }
            ],
            "2": [
                { writeColor: 0, move: "N", nextState: 1 },
                { writeColor: 0, move: "U", nextState: 2 }
            ]
        }
    },
    symmetrical: {
        name: "Symmetrical",
        rules: {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 },
                { writeColor: 2, move: 'R', nextState: 0 },
                { writeColor: 3, move: 'L', nextState: 0 },
                { writeColor: 4, move: 'L', nextState: 0 },
                { writeColor: 5, move: 'R', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    snowflake: {
        name: "Snowflake",
        rules: {
            0: [
                { writeColor: 1, move: 'L', nextState: 1 },
                { writeColor: 1, move: 'R', nextState: 0 }
            ],
            1: [
                { writeColor: 1, move: 'U', nextState: 1 },
                { writeColor: 1, move: 'U', nextState: 2 }
            ],
            2: [
                { writeColor: 0, move: 'N', nextState: 2 },
                { writeColor: 0, move: 'U', nextState: 0 }
            ]
        }
    },
    archimedesSpiral: {
        name: "Archimedes Spiral",
        rules: {
            0: [
                { writeColor: 1, move: 'L', nextState: 0 },
                { writeColor: 2, move: 'R', nextState: 0 },
                { writeColor: 3, move: 'R', nextState: 0 },
                { writeColor: 4, move: 'R', nextState: 0 },
                { writeColor: 5, move: 'R', nextState: 0 },
                { writeColor: 6, move: 'L', nextState: 0 },
                { writeColor: 7, move: 'L', nextState: 0 },
                { writeColor: 8, move: 'L', nextState: 0 },
                { writeColor: 9, move: 'R', nextState: 0 },
                { writeColor: 10, move: 'R', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    logarithmicSpiral: {
        name: "Logarithmic Spiral",
        rules: {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 },
                { writeColor: 2, move: 'L', nextState: 0 },
                { writeColor: 3, move: 'L', nextState: 0 },
                { writeColor: 4, move: 'L', nextState: 0 },
                { writeColor: 5, move: 'L', nextState: 0 },
                { writeColor: 6, move: 'R', nextState: 0 },
                { writeColor: 7, move: 'R', nextState: 0 },
                { writeColor: 8, move: 'R', nextState: 0 },
                { writeColor: 9, move: 'L', nextState: 0 },
                { writeColor: 10, move: 'L', nextState: 0 },
                { writeColor: 11, move: 'L', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    squareFiller: {
        name: "Square Filler",
        rules: {
            0: [
                { writeColor: 1, move: 'L', nextState: 0 },
                { writeColor: 2, move: 'R', nextState: 0 },
                { writeColor: 3, move: 'R', nextState: 0 },
                { writeColor: 4, move: 'R', nextState: 0 },
                { writeColor: 5, move: 'R', nextState: 0 },
                { writeColor: 6, move: 'R', nextState: 0 },
                { writeColor: 7, move: 'L', nextState: 0 },
                { writeColor: 8, move: 'L', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    simpleTuringMachine: {
        name: "Simple Turing Machine",
        rules: {
            0: [
                { writeColor: 1, move: 'N', nextState: 1 },
                { writeColor: 0, move: 'U', nextState: 0 }
            ],
            1: [
                { writeColor: 1, move: 'U', nextState: 1 },
                { writeColor: 0, move: 'N', nextState: 0 }
            ]
        }
    },
    busyBeaver3: {
        name: "Busy Beaver 3",
        rules: {
            0: [
                { writeColor: 1, move: 'N', nextState: 1 },
                { writeColor: 1, move: 'U', nextState: 5 }
            ],
            1: [
                { writeColor: 1, move: 'U', nextState: 3 },
                { writeColor: 1, move: 'N', nextState: 1 }
            ],
            2: [
                { writeColor: 1, move: 'U', nextState: 4 },
                { writeColor: 1, move: 'N', nextState: 6 }
            ],
            3: [
                { writeColor: 1, move: 'U', nextState: 1 },
                { writeColor: 1, move: 'N', nextState: 5 }
            ],
            4: [
                { writeColor: 1, move: 'N', nextState: 3 },
                { writeColor: 1, move: 'U', nextState: 1 }
            ],
            5: [
                { writeColor: 1, move: 'N', nextState: 4 },
                { writeColor: 1, move: 'U', nextState: 6 }
            ],
            6: [
                { writeColor: 0, move: 'S', nextState: 6 },
                { writeColor: 1, move: 'S', nextState: 6 }
            ]
        }
    },
    busyBeaver4: {
        name: "Busy Beaver 4",
        rules: {
            0: [
                { writeColor: 1, move: 'N', nextState: 1 },
                { writeColor: 1, move: 'U', nextState: 5 }
            ],
            1: [
                { writeColor: 1, move: 'U', nextState: 4 },
                { writeColor: 0, move: 'U', nextState: 6 }
            ],
            2: [
                { writeColor: 1, move: 'N', nextState: 8 },
                { writeColor: 1, move: 'U', nextState: 7 }
            ],
            3: [
                { writeColor: 1, move: 'N', nextState: 3 },
                { writeColor: 0, move: 'N', nextState: 0 }
            ],
            4: [
                { writeColor: 1, move: 'U', nextState: 1 },
                { writeColor: 1, move: 'N', nextState: 5 }
            ],
            5: [
                { writeColor: 1, move: 'N', nextState: 4 },
                { writeColor: 0, move: 'N', nextState: 6 }
            ],
            6: [
                { writeColor: 1, move: 'U', nextState: 8 },
                { writeColor: 1, move: 'N', nextState: 7 }
            ],
            7: [
                { writeColor: 1, move: 'U', nextState: 3 },
                { writeColor: 0, move: 'U', nextState: 0 }
            ],
            8: [
                { writeColor: 0, move: 'S', nextState: 8 },
                { writeColor: 1, move: 'S', nextState: 8 }
            ]
        }
    },
    busyBeaver5: {
        name: "Busy Beaver 5",
        rules: {
            0: [
                { writeColor: 1, move: 'N', nextState: 1 },
                { writeColor: 1, move: 'U', nextState: 7 }
            ],
            5: [
                { writeColor: 1, move: 'U', nextState: 1 },
                { writeColor: 1, move: 'N', nextState: 7 }
            ],
            1: [
                { writeColor: 1, move: 'N', nextState: 2 },
                { writeColor: 1, move: 'N', nextState: 1 }
            ],
            6: [
                { writeColor: 1, move: 'U', nextState: 2 },
                { writeColor: 1, move: 'U', nextState: 1 }
            ],
            2: [
                { writeColor: 1, move: 'N', nextState: 3 },
                { writeColor: 0, move: 'U', nextState: 9 }
            ],
            7: [
                { writeColor: 1, move: 'U', nextState: 3 },
                { writeColor: 0, move: 'N', nextState: 9 }
            ],
            3: [
                { writeColor: 1, move: 'U', nextState: 5 },
                { writeColor: 1, move: 'U', nextState: 8 }
            ],
            8: [
                { writeColor: 1, move: 'N', nextState: 5 },
                { writeColor: 1, move: 'N', nextState: 8 }
            ],
            4: [
                { writeColor: 1, move: 'N', nextState: 10},
                { writeColor: 0, move: 'U', nextState: 5 }
            ],
            9: [
                { writeColor: 1, move: 'U', nextState: 10},
                { writeColor: 0, move: 'N', nextState: 5 }
            ],
            10: [
                { writeColor: 0, move: 'S', nextState: 10 },
                { writeColor: 1, move: 'S', nextState: 10 }
            ]
        }
    }
};
